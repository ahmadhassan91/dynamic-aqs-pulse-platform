# Pulse Platform — Leads Module PRD

## 1. Document Control

| Field | Value |
|---|---|
| Version | 2.0 |
| Date | 2026-04-20 |
| Status | Scope confirmation draft for Dynamic AQS review |
| Module owner | Pulse delivery team |
| Primary reviewers | Dynamic AQS sales leadership, Strategic Growth team, operations lead, customer setup stakeholder |
| Related documents | `00_README_AND_MEETING_AGENDA.md`, Training PRD, Territory PRD, Calendar PRD |

---

## 2. Executive Summary

The Leads module will be the governed front door into Pulse CRM. It will receive prospect and dealer inquiries from branded websites, manual internal entry, imports, referrals, and field/mobile capture; classify them correctly; route them to the right owner; enforce response expectations; and move them through the lead-to-first-order journey without losing auditability. Pulse will treat the lead record as the backbone for discovery, CIS handoff, onboarding readiness, and eventual customer activation. The goal of this module is to give Dynamic AQS one operational pipeline truth instead of separate HubSpot exports, spreadsheets, and offline follow-up habits.

---

## 3. Module Objective

Pulse will provide a single lead management system that will:

- accept leads from every approved intake channel
- preserve source attribution and classification from day one
- detect duplicates before they create operational noise
- route and assign leads by governed business rules
- track lifecycle, SLA, and responsibility handoffs clearly
- support discovery, CIS handoff, onboarding readiness, and first-order activation
- provide leadership with reliable visibility into pipeline health and follow-up discipline

---

## 4. Scope Statement

### 4.1 Pulse Will Support

- branded website lead capture across Dynamic AQS websites
- internal manual lead entry for sales, Strategic Growth, and authorized operations roles
- CSV / XLSX bulk import with preview, validation, mapping, and duplicate review
- trade-show, event, and referral intake paths that need to become governed leads
- recurring affinity and ownership roster ingestion with stewardship review
- mobile / field lead capture from business-card or badge scan
- explicit lead classification using:
  - affinity group
  - ownership group
  - independent / no-group cases
- source attribution including brand, source site, campaign, capture method, and referral context
- duplicate review against existing leads and customer/account records
- routing to Strategic Growth versus territory-owned follow-up based on approved routing rules
- territory assignment and visibility alignment with the Territory module
- seven-stage operational pipeline with lifecycle controls
- discovery scheduling and discovery outcome capture
- CIS handoff readiness and onboarding milestone tracking
- potential-value tracking for pipeline reporting
- response-time tracking and escalation rules
- lead conversion only when the first-order boundary is reached
- activity logging and historical audit trail across the entire lead lifecycle

### 4.2 This PRD Will Also Cover

- how Pulse will handle leads that match an existing record
- how classification and ownership will be captured early enough to support downstream onboarding and pricing logic
- how manual, public, and imported leads will follow the same governed routing backbone
- what Dynamic AQS needs to confirm before the lead scope is locked

### 4.3 Later-Phase / Separate Decision Items

These items remain part of the broader Pulse vision, but require later approval or a separate dependency decision:

- direct HubSpot data migration mechanics and cutover timing
- deeper BI and advanced executive forecasting beyond core pipeline reporting
- social-media-native intake channels
- later mobile field-selling behaviors beyond lead capture
- broader partner/dealer portal self-service behavior after customer activation

---

## 5. Primary Future-State User Journeys

### 5.1 Journey A — Branded Website Inquiry Becomes A Lead

1. A prospect completes a branded Dynamic AQS website form.
2. Pulse validates the submission against that website’s configured required fields.
3. Pulse stamps the lead with source site, brand, capture method, and campaign context.
4. Pulse checks for duplicates against existing leads and customers.
5. Pulse either:
   - creates a new lead, or
   - routes the submission into a duplicate-review path tied to an existing record.
6. Once accepted, Pulse routes the lead according to the approved routing basis and territory rules.
7. The lead enters the governed pipeline and response timing begins immediately.

### 5.2 Journey B — Internal User Creates A Lead Manually

1. A sales or Strategic Growth user opens the internal intake form.
2. The user enters contact details, company, state, service-tech / truck information, and source context.
3. The user selects the appropriate affinity-group and ownership-group status.
4. Pulse validates the lead, checks for duplicates, and records the intake source as internal/manual.
5. Pulse routes the lead and creates the operational record in the same pipeline used for website and import intake.

### 5.3 Journey C — Operations Imports A Roster Or Event File

1. Operations uploads a CSV or XLSX file.
2. Pulse presents column mapping and validates each row.
3. Pulse highlights duplicate matches and invalid rows before commit.
4. The operator decides how each ambiguous row will be handled.
5. Pulse creates or links records and preserves the import-run audit trail.

### 5.4 Journey D — Lead Is Qualified Through Discovery

1. The assigned owner makes initial contact and logs the activity.
2. Pulse records the first meaningful contact and stops the initial-contact timer.
3. The owner schedules discovery or records an approved skip / fast-track reason.
4. Discovery outcomes are captured in structured form and become part of the lead record.
5. The lead advances toward CIS handoff once qualification is complete.

### 5.5 Journey E — Lead Reaches CIS And Onboarding Readiness

1. The qualified lead is handed into the CIS / finance setup path.
2. Pulse keeps the lead as a lead during CIS and onboarding preparation.
3. Pulse records readiness milestones such as discovery completion, CIS progress, training readiness, and setup completion.
4. The lead does not become a customer simply because CIS has started or because a form has been returned.

### 5.6 Journey F — Lead Converts On First Order

1. Pulse confirms the first-order activation event.
2. Pulse creates or finalizes the customer/account record from the lead backbone.
3. Territory, classification, contacts, and downstream readiness context carry forward.
4. The lead remains available as historical evidence and reporting context.

### 5.7 Journey G — Field Rep Captures A Lead From A Business Card Or Badge

1. A field user opens Pulse on mobile and chooses card or badge capture.
2. Pulse extracts candidate data from the image.
3. The user confirms or corrects the extracted data and adds any known routing or source details.
4. Pulse applies the same duplicate, classification, and routing rules used for every other intake path.

---

## 6. Functional Capabilities

### 6.1 Intake And Identification

Pulse will:

- support website, manual, import, referral, and mobile/event intake paths
- preserve source site, source brand, source detail, and capture method
- support flexible import mapping for recurring files
- retain captured source artefacts where they are needed for audit or review
- validate email, phone, required fields, and basic identity quality at intake

### 6.2 Classification And Segmentation

Pulse will:

- capture affinity group and ownership group as two separate business dimensions
- support explicit “independent / no group” handling
- support “unknown / not yet assessed” only where Dynamic AQS wants a review-stage placeholder
- keep brand / private-label context distinct from affinity-group membership
- preserve classification downstream into CIS, onboarding, customer setup, and reporting

### 6.3 Duplicate Handling

Pulse will:

- check website, manual, mobile, and imported leads against existing leads and accounts
- surface likely matches for human review where needed
- support a governed resolution path rather than silently creating duplicates
- preserve submission history even when a new submission is attached to an existing lead

### 6.4 Routing And Assignment

Pulse will:

- route leads using the approved service-tech / truck-count and territory rule set
- distinguish Strategic Growth handling from territory-owned handling
- align routed ownership with the Territory module
- preserve routing history and override reasons
- support manual reassignment by authorized roles

### 6.5 Lifecycle And Workflow

Pulse will:

- maintain a clear lead lifecycle from new lead through customer-active
- support non-linear operational handoffs where Dynamic AQS requires them
- distinguish pipeline stage from lifecycle status
- support parked, reopened, and not-interested paths with reasons
- track time in stage, first contact, and milestone progression

### 6.6 Discovery, CIS, And Activation Boundary

Pulse will:

- schedule and record discovery activity
- support discovery completion or approved skip / fast-track handling
- hand qualified leads into CIS and onboarding readiness
- keep raw payment-card data outside CRM
- treat first order as the customer-activation boundary unless Dynamic AQS confirms another rule

### 6.7 Operational Visibility

Pulse will:

- provide pipeline and queue views
- surface rating, source, classification, routing, SLA, and next-action context
- support list and Kanban style operational views
- allow activity logging across calls, meetings, notes, and follow-up actions
- provide leadership reporting by stage, owner, source, territory, and classification

---

## 7. Business Rules Pulse Will Enforce

| # | Rule |
|---|---|
| BR-L-01 | A prospect will remain a lead until the approved customer-activation boundary is reached. |
| BR-L-02 | Every lead will carry source attribution from the moment it enters Pulse. |
| BR-L-03 | Affinity group and ownership group will be stored separately and will not be collapsed into one field. |
| BR-L-04 | Duplicate review will occur against both active leads and existing customer/account records. |
| BR-L-05 | Routing decisions and overrides will be auditable. |
| BR-L-06 | The same routing backbone will apply regardless of whether the lead arrived from a website, manual entry, import, or mobile capture. |
| BR-L-07 | Discovery, CIS, and onboarding will be tracked as governed workflow steps even when the operational order varies in special cases. |
| BR-L-08 | Sensitive payment-card data will not be stored directly in Pulse as part of lead or CIS flow. |
| BR-L-09 | Initial-contact response expectations and escalations will be measurable at lead level. |
| BR-L-10 | Reassignments will not rewrite prior activity authorship or historical ownership decisions. |

---

## 8. Data And Integration Highlights

At business level, this module will depend on and feed the following:

| Area | Proposed Pulse Role |
|---|---|
| Website forms | Pulse will receive, validate, and classify branded lead submissions |
| Customer / Accounts | Pulse will check for matches and later convert qualified leads at the correct boundary |
| Territory | Pulse will use territory truth for routing, visibility, and ownership |
| Training | Pulse will pass qualified/activated records into training-ready workflows |
| CIS / Finance | Pulse will hand qualified leads into CIS and readiness workflows without storing raw card data |
| Calendar | Pulse will expose discovery and other qualifying events into the centralized calendar |
| Reporting | Pulse will feed source, lifecycle, routing, classification, and potential-value reporting |

---

## 9. Assumptions To Confirm

| # | Assumption | Why It Matters |
|---|---|---|
| A-L-01 | The main routing split will be based on service-tech / truck-count threshold unless Dynamic AQS confirms a different primary basis. | This determines automatic assignment, queue ownership, and leadership reporting. |
| A-L-02 | Strategic Growth handling will remain a distinct ownership path for smaller or designated prospects. | This changes lead ownership, alerts, and follow-up responsibility. |
| A-L-03 | Affinity-group and ownership-group classification will be captured early enough to support onboarding and pricing logic. | This determines whether Pulse can safely drive downstream processes without re-entry. |
| A-L-04 | A prospect will remain a lead until first order or the approved equivalent customer-activation boundary. | This affects CRM/ERP handoff and customer creation timing. |
| A-L-05 | Website submissions may begin with lighter data than internal manual entries, but will still enter the same governed pipeline. | This changes how early validation and classification behave for public intake. |
| A-L-06 | Mobile business-card and badge capture belongs in the lead-intake scope rather than being treated as a separate app-only utility. | This affects module ownership and field/mobile parity. |

---

## 10. Open Questions For Dynamic AQS Decision

| # | Question | Options To Confirm | Why Decision Is Needed |
|---|---|---|---|
| Q-L-01 | What is the final routing basis and threshold? | service-tech count / truck count / other approved rule | Pulse should not lock routing behavior on an incorrect business basis. |
| Q-L-02 | How should Strategic Growth ownership behave? | pooled team ownership / named owner / round-robin / affinity-based override | This changes assignment visibility and alerting. |
| Q-L-03 | What is the approved duplicate-resolution policy? | attach to existing / create anyway / review queue / merge-on-approval | This changes lead quality and customer history integrity. |
| Q-L-04 | When is “unknown / not yet assessed” acceptable for classification? | public intake only / temporary review state / never acceptable / other | This changes intake UX and downstream data quality. |
| Q-L-05 | Is discovery mandatory for every lead? | always required / skippable with reason / allowed fast-track by role | This changes stage rules and calendar behavior. |
| Q-L-06 | How should homeowner or non-dealer inquiries be treated? | same pipeline / filtered queue / separate intake type / redirect | This changes whether all website traffic belongs in the same revenue workflow. |
| Q-L-07 | What alert channels should accompany lead ownership and SLA escalation? | in-app only / email / Teams / mixed by role | This changes follow-up behavior and provider dependencies. |

---

## 11. Later-Phase / Separate Decision Items

These items may still belong in the broader Pulse roadmap, but will not be assumed as finalized by this PRD:

- advanced marketing attribution and campaign performance analysis
- social-media-native lead capture
- broader field-selling and route-selling actions from mobile
- deeper predictive scoring and forecasting models
- HubSpot historical migration rules beyond the one-time cutover decision

---

## 12. Approval Checklist

Dynamic AQS approval of this PRD will confirm:

- the intake channels listed here are the right lead-entry surfaces
- the proposed routing and assignment model is directionally correct
- the classification model reflects Dynamic AQS business reality
- the first-order / activation boundary is framed correctly
- the open questions capture the real business decisions still needed

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
All items with **Can do now = Yes** have no external dependency (no Acumatica, Microsoft Graph, or payment provider required).

### Sprint 1 — Quick Wins (S effort)
| ID | Requirement | Component | Can do now? | Status |
|----|-------------|-----------|-------------|--------|
| UX-L-001 | No empty state when territory filter returns zero leads | LeadWorkspace.tsx | Yes | Open |
| UX-L-002 | Kanban stage columns render blank when empty — no ghost-card prompt | LeadWorkspace.tsx | Yes | Open |
| UX-L-003 | SLA breach banner missing on lead hero panel when slaState.overdue = true | LeadRecordWorkspace.tsx | Yes | Open |
| UX-L-004 | No lead lifecycle badge on list rows (active vs parked indistinguishable) | LeadWorkspace.tsx | Yes | Open |
| UX-L-005 | No "Reassign lead" action with reason field on lead record | LeadRecordWorkspace.tsx | Yes | Open |
| UX-L-006 | Duplicate resolution missing "Use existing record" path | LeadWorkspace.tsx | Yes | Open |
| UX-L-007 | leadCaptureMethod not set to card_scan when OCR file was used | LeadWorkspace.tsx | Yes | Open |
| UX-L-008 | source_brand_tag and private_label_name missing from intake form | LeadWorkspace.tsx | Yes | Open |
| UX-L-009 | In-app SLA breach notifications not surfaced (no Graph required) | LeadWorkspace.tsx | Yes | Open |

### Sprint 2 — Core Workflow (M effort)
| ID | Requirement | Component | Can do now? | Status |
|----|-------------|-----------|-------------|--------|
| UX-L-010 | No freeform activity/note logging on lead record — timeline is read-only | LeadRecordWorkspace.tsx | Yes | Done |
| UX-L-011 | Backward Kanban stage drag has no reason gate (BR-L-07 governed transitions) | LeadWorkspace.tsx | Yes | Done |
| UX-L-012 | Insights tab missing time-in-stage, SLA breach trend, pipeline value, territory breakdown | LeadWorkspace.tsx | Yes | Done |
| UX-L-013 | No pagination on lead list — hard-coded limit: 200 | LeadWorkspace.tsx | Yes | Done |
| UX-L-014 | No filter by affinity group or ownership group in lead queue | LeadWorkspace.tsx | Yes | Done |
| UX-L-015 | Website form setup page has no form preview or test-submission button | LeadWebsiteFormsWorkspace.tsx | Yes | Done (preview modal + test-submission ext function; file-owned preview already implemented) |
| UX-L-016 | "Schedule discovery call" action does not wire to CalendarWorkspace | LeadRecordWorkspace.tsx | Yes | Done |
| UX-L-017 | Referral source has no referral-context fields (referred-by name, relationship) | LeadWorkspace.tsx | Yes | Done (sourceDetail field shown when source=referral; relationship field parked — no DB column) |

_To be completed during the review meeting._
