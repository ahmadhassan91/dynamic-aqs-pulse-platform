# Pulse Platform — Leads Module PRD

## Document Control

| Field | Value |
|---|---|
| Version | 3.0 |
| Date | 2026-06-09 |
| Status | Enriched — traceability closure pass complete |
| Module owner | Pulse delivery team |
| Primary reviewers | Dynamic AQS sales leadership, Strategic Growth team, operations lead, customer setup stakeholder |
| Related documents | `00_README_AND_MEETING_AGENDA.md`, Training PRD, Territory PRD, Calendar PRD, CIS PRD |

---

## Meeting Traceability

| Session | Date | Key Speakers | Lead-Relevant Content |
|---------|------|--------------|----------------------|
| Discovery Session 1 | 16 Feb 2026 | C G, Dan Harshbarger, Michelle Hogan, Don Hearn, Adrienne Cardinale | Lead-to-customer lifecycle; CIS trigger vs first-order ERP gate; affinity/ownership groups; PCI compliance; mobile/card capture wish list |
| Discovery Session 2 | 18 Feb 2026 | C G, Michelle Hogan, Adrienne Cardinale, Maryam Zahid | Current CRM lead entry pain points; pipeline stages; source attribution; routing rules; affinity group required field; truck-count routing; discovery and CIS workflow walkthrough |
| Discovery Session 3 (Validation) | 20 Feb 2026 | C G, Michelle Hogan, Adrienne Cardinale, Dan Harshbarger | As-is current-state confirmed via infographic; credit approval workflow; terms workflow; field data validation |
| Discovery Session 4 | 24 Feb 2026 | C G, Don Hearn, Michelle Hogan, Dan Harshbarger | TM lifecycle from discovery through training; roster/affinity import; truck-count routing confirmed; Map My Customer pain points; historical sales visibility |
| PRD-Lead-To-Dealer (working doc) | Multiple sessions | Ahmad Hassan | Compiled target-state lead-to-first-customer workflow with full integration points |

---

## Source Inventory

| SRC ID | Absolute Path | What It Sourced |
|--------|--------------|-----------------|
| SRC-L-001 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Discovery Session 1 - 16th Feb 2026.md` | Lead-to-customer lifecycle boundary (lead until first order — C G verbatim); affinity/ownership group fields; PCI/CIS credit card compliance; mobile business-card capture (Don Hearn); source attribution from 16 websites; HubSpot pain point; ERP integration gate |
| SRC-L-002 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/18 feb 2026 Discovery session 2.md` | Manual lead entry; spreadsheet-based pipeline; source attribution gap; truck-count routing (C G — "five trucks or less → strategic growth team"); affinity group field requirement; discovery → CIS → order stages; lead rating; roster import need; Kanban pipeline view request |
| SRC-L-003 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/20 Feb session 3 _ Discovery session 3 _ Validations.md` | As-is flow confirmed: HubSpot → static Excel → Dropbox → Dynamics → manual Acumatica; credit approval workflow; terms in drop-down field; reporting is the #1 pain point |
| SRC-L-004 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24 Feb 2026 Discovery session 4.md` | TM discovery → training lifecycle; roster import from affinity groups (300–1000 records, monthly/quarterly); truck-count threshold confirmed; Map My Customer mapping and color-coding; three initial WebEx trainings after first order; ownership transfer to TM on first order |
| SRC-L-005 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/PRD-Lead-To-Dealer.md` | Compiled target-state PRD with all integration points; lifecycle states; source attribution; routing; CIS workflow; ERP gate; training onboarding; consignment trigger |
| SRC-L-006 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/leads/service.ts` | Build evidence: `createLead`, `captureWebsiteLead`, `importLeads`, `previewLeadImport`, `reviewLeadImport`, `commitLeadImportRun`, `transitionLeadStage`, `updateLeadLifecycle`, `logLeadInitialContact`, `logLeadActivityNote`, `scheduleLeadDiscovery`, `completeLeadDiscovery`, `skipLeadDiscovery`, `updateLeadRoutingPolicy`, `processLeadOperationalAlertScanJob` |
| SRC-L-007 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/leads/readiness.ts` | Build evidence: `getLeadReadiness`, `generateLeadReadinessChecklist`, `updateLeadReadinessItem`, `validateLeadConversionPreparation`, `convertLeadOnFirstOrder`, `listLeadContacts`, `createLeadContact`, `importLeadContactsFromCis` |
| SRC-L-008 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/leads/ocr.ts` | Build evidence: `previewLeadOcrCapture`; supports `business_card` and `show_badge` OCR modes |
| SRC-L-009 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/leads/alerts.ts` | Build evidence: `processLeadOperationalAlertScanJob`, `processLeadOperationalAlertDeliveryJob`; Microsoft Graph delivery dependency |
| SRC-L-010 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/contracts/src/leads.ts` | Contract definitions: 7-stage pipeline (`new` → `discovery_scheduled` → `discovery_completed` → `cis_sent` → `cis_signed` → `onboarding_completed` → `customer_active`); routing teams; capture methods; lifecycle statuses; consignment interest statuses |
| SRC-L-011 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/leads/` | UI build evidence: `LeadWorkspace.tsx`, `LeadRecordWorkspace.tsx`, `LeadWebsiteFormsWorkspace.tsx`, `LeadImportWorkbench.tsx`, `GroupRosterImportWorkbench.tsx`, `LeadCisPanel.tsx`, `LeadOnboardingReadyPanel.tsx`, `LeadFinanceQueue.tsx`, `PublicWebsiteLeadCaptureForm.tsx`, `ActivityManager.tsx` |

---

## 1. Document Control

| Field | Value |
|---|---|
| Version | 2.0 → 3.0 |
| Date | 2026-04-20 → enriched 2026-06-09 |
| Status | Scope confirmation draft enriched with traceability closure pass |
| Module owner | Pulse delivery team |
| Primary reviewers | Dynamic AQS sales leadership, Strategic Growth team, operations lead, customer setup stakeholder |
| Related documents | `00_README_AND_MEETING_AGENDA.md`, Training PRD, Territory PRD, Calendar PRD |

---

## 2. Executive Summary

The Leads module will be the governed front door into Pulse CRM. It will receive prospect and dealer inquiries from branded websites, manual internal entry, imports, referrals, and field/mobile capture; classify them correctly; route them to the right owner; enforce response expectations; and move them through the lead-to-first-order journey without losing auditability. Pulse will treat the lead record as the backbone for discovery, CIS handoff, onboarding readiness, and eventual customer activation. The goal of this module is to give Dynamic AQS one operational pipeline truth instead of separate HubSpot exports, spreadsheets, and offline follow-up habits.

On 16 Feb 2026, C G stated: "Acumatica will always be the central point for all financial data. And the CRM will only reflect what Accumatica says. And then the CRM will be the central point of truth for all customer information." (SRC-L-001)

On 16 Feb 2026, C G confirmed the customer-activation boundary: "they're a lead until they submit an order, even if they submitted a customer information sheet" (SRC-L-001). This is the governing rule for the module.

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

### 4.2 This PRD Also Covers

- how Pulse will handle leads that match an existing record
- how classification and ownership will be captured early enough to support downstream onboarding and pricing logic
- how manual, public, and imported leads will follow the same governed routing backbone
- what Dynamic AQS needs to confirm before the lead scope is locked

### 4.3 Out-of-Scope / Later-Phase / Separate Decision Items (Parked by Design)

These items require later approval or a separate dependency decision:

| Item | Parking Reason |
|------|---------------|
| Acumatica ERP sync (customer record creation, order posting) | ERP endpoint certification required; only triggers on first order |
| Credit-card tokenization / PCI compliance provider integration | Payment provider dependency — Dan Harshbarger flagged 16 Feb 2026 (SRC-L-001) |
| Microsoft Graph sendMail for lead alert delivery | Graph credentials / provider certification not yet available |
| Direct HubSpot data migration mechanics and cutover timing | Separate migration decision |
| Deeper BI and advanced executive forecasting | Beyond core pipeline reporting |
| Social-media-native intake channels | Not in discovery scope |
| Later mobile field-selling behaviors beyond lead capture | Separate mobile scope |
| Broader partner/dealer portal self-service after customer activation | Dealer portal module |

---

## 5. Primary Future-State User Journeys

### 5.1 Journey A — Branded Website Inquiry Becomes A Lead

1. A prospect completes a branded Dynamic AQS website form.
2. Pulse validates the submission against that website's configured required fields.
3. Pulse stamps the lead with source site, brand, capture method, and campaign context.
4. Pulse checks for duplicates against existing leads and customers.
5. Pulse either creates a new lead or routes the submission into a duplicate-review path tied to an existing record.
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

On 24 Feb 2026, Dan Harshbarger said: "It would be great if there was a nicer tool to just take a CSV and say this column is this field" (SRC-L-004). Michelle Hogan confirmed affinity group rosters arrive from 300 to 1,000 members monthly or quarterly (SRC-L-004).

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

On 16 Feb 2026, C G said: "Once an initial order is submitted, that closes that lead out and now they're in an actual customer." (SRC-L-001)

### 5.7 Journey G — Field Rep Captures A Lead From A Business Card Or Badge

1. A field user opens Pulse on mobile and chooses card or badge capture.
2. Pulse extracts candidate data from the image using OCR.
3. The user confirms or corrects the extracted data and adds any known routing or source details.
4. Pulse applies the same duplicate, classification, and routing rules used for every other intake path.

On 16 Feb 2026, Don Hearn said: "Is there a way that we could take a picture of a business card on our phone? That would integrate it right into the app." (SRC-L-001)

---

## 6. Functional Capabilities (preserved from v2.0)

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
- support explicit "independent / no group" handling
- support "unknown / not yet assessed" only where Dynamic AQS wants a review-stage placeholder
- keep brand / private-label context distinct from affinity-group membership
- preserve classification downstream into CIS, onboarding, customer setup, and reporting

On 16 Feb 2026, Dan Harshbarger said: "Each customer can have up to one ownership group, up to one affinity group, and then they can also have a brand label because being in that affinity group doesn't mean that you get that brand label that's associated with the affinity group. Those three attributes that we set up." (SRC-L-001)

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

On 18 Feb 2026, C G said: "We have a newly created team that handles, with exceptions, five truck companies or less. So when a lead comes in and they're four trucks, they're immediately going to our strategic growth team rather than disseminated to our national territory managers." (SRC-L-002)

### 6.5 Lifecycle And Workflow

Pulse will:
- maintain a clear lead lifecycle from new lead through customer-active
- support non-linear operational handoffs where Dynamic AQS requires them
- distinguish pipeline stage from lifecycle status
- support parked, reopened, and not-interested paths with reasons
- track time in stage, first contact, and milestone progression

On 18 Feb 2026, Michelle Hogan said: "Sometimes the steps don't always go in the order we'd like them to." (SRC-L-002) Steps must be completable out of order with incomplete status shown.

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

On 16 Feb 2026, C G said: "We go into a lead and we go — okay, here's all our leads and these are the stages each lead is in. Here's all the leads we haven't contacted yet. Here are the leads where we've contacted them and got a conversation. Here are discovery calls that have been scheduled. And all of that is still leads because they don't become a customer until they make a purchase." (SRC-L-001)

---

## 7. Business Rules Pulse Will Enforce

| # | Rule | Source |
|---|---|---|
| BR-L-01 | A prospect will remain a lead until the approved customer-activation boundary is reached (first order). | C G, 16 Feb 2026 (SRC-L-001) |
| BR-L-02 | Every lead will carry source attribution from the moment it enters Pulse. | Adrienne Cardinale, 18 Feb 2026 (SRC-L-002) |
| BR-L-03 | Affinity group and ownership group will be stored separately and will not be collapsed into one field. | Dan Harshbarger, 16 Feb 2026 (SRC-L-001) |
| BR-L-04 | Duplicate review will occur against both active leads and existing customer/account records. | Michelle Hogan, 18 Feb 2026 (SRC-L-002) |
| BR-L-05 | Routing decisions and overrides will be auditable. | (inferred — all routing changes must be logged) |
| BR-L-06 | The same routing backbone will apply regardless of whether the lead arrived from a website, manual entry, import, or mobile capture. | C G, 16 Feb 2026 (SRC-L-001) |
| BR-L-07 | Discovery, CIS, and onboarding will be tracked as governed workflow steps even when the operational order varies in special cases. | Michelle Hogan, 18 Feb 2026 (SRC-L-002) — "sometimes the steps don't always go in the order we'd like" |
| BR-L-08 | Sensitive payment-card data will not be stored directly in Pulse as part of lead or CIS flow. | Dan Harshbarger + Ahmad Hassan, 16 Feb 2026 (SRC-L-001) — "we're not in compliance with PCI right now" |
| BR-L-09 | Initial-contact response expectations and escalations will be measurable at lead level. | C G, 18 Feb 2026 (SRC-L-002) — "whoever's in front of their computer, make the call and send it on" |
| BR-L-10 | Reassignments will not rewrite prior activity authorship or historical ownership decisions. | (inferred standard) |
| BR-L-11 | Affinity group must have an "independent / none" option; unknown is a valid review-state placeholder but should not be the default. | C G + Adrienne Cardinale, 18 Feb 2026 (SRC-L-002) |
| BR-L-12 | Pulse will not push leads to Acumatica; the ERP activation trigger is the first order. | C G + Dan Harshbarger, 16 Feb 2026 (SRC-L-001) |
| BR-L-13 | Leads from all 16+ branded websites must carry the specific source-site identity to enable attribution reporting by website. | Michelle Hogan, 18 Feb 2026 (SRC-L-002) — "I believe it's our solace air website that gives us the most leads but I would really like to have a better handle on that" |
| BR-L-14 | A lead routes to the Strategic Growth team when the truck/service-tech count is below the routing threshold (currently 5). | C G, 18 Feb 2026 (SRC-L-002) |

---

## 8. Data And Integration Highlights

| Area | Proposed Pulse Role |
|---|---|
| Website forms | Pulse will receive, validate, and classify branded lead submissions — replacing HubSpot's intake role |
| Affinity/ownership roster import | Pulse will import CSV/XLSX member lists (300–1000 records) with column mapping and duplicate review |
| Customer / Accounts | Pulse will check for matches and later convert qualified leads at the first-order boundary |
| Territory | Pulse will use territory truth for routing, visibility, and ownership |
| Training | Pulse will pass qualified/activated records into training-ready workflows; three initial WebEx trainings trigger after first order |
| CIS / Finance | Pulse will hand qualified leads into CIS and readiness workflows without storing raw card data |
| Calendar | Pulse will expose discovery and other qualifying events into the centralized calendar |
| Reporting | Pulse will feed source, lifecycle, routing, classification, and potential-value reporting |
| Acumatica ERP | Pulse will trigger account/order creation on first order only (parked until endpoint certification) |

---

## 9. FUNCTIONAL REQUIREMENTS

### 9.1 Lead Intake

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|-------------|---------------------|----------|--------------|-----|
| FR-L-001 | Pulse shall receive leads directly from branded Dynamic AQS website forms, eliminating the HubSpot → Dropbox → Dynamics manual chain. | Website submission creates a `WebsiteLeadSubmission` record with source site, timestamp, and all submitted fields within 5 seconds. No manual step required between submission and Pulse record creation. | P0 | Built | SRC-L-001, SRC-L-005, SRC-L-006, SRC-L-011 |
| FR-L-002 | Pulse shall support manual lead creation by internal staff (sales, strategic growth, authorized operations). | Internal user can create a lead with required fields via the intake form. Record is assigned an intake source of `manual_entry`. | P0 | Built | SRC-L-002, SRC-L-006 |
| FR-L-003 | Pulse shall support CSV / XLSX bulk import with column mapping, row validation, duplicate preview, and commit/rollback. | Import flow shows preview of mapped rows, flags duplicates and validation errors, allows per-row decision before commit. Import run is auditable by run ID. | P0 | Built | SRC-L-004, SRC-L-006, SRC-L-011 |
| FR-L-004 | Pulse shall support importing affinity/ownership group roster files (CSV/XLSX, 300–1,000 records) with flexible column mapping. | Operator can map source columns to CRM lead fields. Roster upload preserves source affinity group label. Duplicate leads are surfaced for review before commit. | P0 | Built (`GroupRosterImportWorkbench.tsx`) | SRC-L-004 |
| FR-L-005 | Pulse shall support mobile / field lead capture via OCR of a business card or trade-show badge. | OCR extracts candidate name, company, email, phone fields. User can confirm or correct before creating the lead. Capture method is recorded as `business_card` or `show_badge`. | P1 | Partial — `previewLeadOcrCapture` wired; `leadCaptureMethod` not always set to OCR source on UI (UX-L-007) | SRC-L-001, SRC-L-008 |
| FR-L-006 | Pulse shall preserve source attribution on every lead: source type (website, manual, import, referral, mobile/event), specific source site/brand, campaign context, capture method, and referral-context details. | `source_brand_tag`, `source_site_id`, `capture_method`, and referral fields are stored on the lead record. Attribution is visible in lead detail and retained through all subsequent stage changes. | P0 | Partial — `source_brand_tag` and `private_label_name` missing from intake form (UX-L-008) | SRC-L-001, SRC-L-002, SRC-L-011 |
| FR-L-007 | Pulse shall validate email format, phone format, and required fields at lead intake across all intake paths. | Invalid email or phone format is rejected with an explicit error at submission. Leads without required fields cannot be committed. | P0 | Built | SRC-L-001, SRC-L-002 |
| FR-L-008 | Pulse shall check each new lead against existing leads and customer/account records for duplicates before creating a new record. | Duplicate check runs automatically. Likely matches are surfaced in a review screen. Submitter or reviewer chooses: create new, attach to existing, or confirm existing. | P0 | Built | SRC-L-002, SRC-L-006, SRC-L-011 |

### 9.2 Classification And Segmentation

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|-------------|---------------------|----------|--------------|-----|
| FR-L-009 | Pulse shall store affinity group and ownership/PE group as two independent fields on the lead record. | Both fields exist independently on the lead record. Changing one does not affect the other. Both are preserved through all downstream stages. | P0 | Built | SRC-L-001, SRC-L-002 |
| FR-L-010 | Pulse shall support "independent / none" and "unknown / not yet assessed" as valid options for both affinity group and ownership group. | Intake form presents explicit "independent", "none", and "unknown" options in addition to named group values. "Unknown" is a permitted review-state but is flagged for resolution before CIS stage. | P0 | Built | SRC-L-002 — C G: "it's not always affinity groups, right? So we need an option that says none"; Adrienne: "shouldn't hold up putting in the lead" |
| FR-L-011 | Pulse shall store a lead rating (e.g., cold / warm / hot / whale) as a visible classification field. | Lead rating is captured at intake and visible in list and detail views. Rating is selectable at any time by authorized users. | P1 | Built | SRC-L-002 — Michelle Hogan: "we do like that … whether it's a warm to hot lead a cold lead or not interested sort of a situation and a whale" |
| FR-L-012 | Pulse shall capture the truck/service-tech count on the lead record and use it as a routing input. | Truck/service-tech count field is present on the intake form. Value is used automatically by the routing engine to direct the lead to the correct team. | P0 | Built | SRC-L-002 — Michelle Hogan: "number of trucks are critical … very helpful and they all seem to be filling that field out" |

### 9.3 Routing And Assignment

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|-------------|---------------------|----------|--------------|-----|
| FR-L-013 | Pulse shall automatically route leads to the Strategic Growth team when the truck/service-tech count is below the configured routing threshold (currently 5). | Leads with fewer than 5 trucks route to `strategic_growth` team. Leads with 5 or more trucks route to `national_tm` team. Threshold is configurable in the admin routing policy. | P0 | Built | SRC-L-002 — C G: "five truck companies or less … going to our strategic growth team" |
| FR-L-014 | Pulse shall apply the same routing backbone to leads from all intake paths: website, manual entry, import, mobile/event, and referral. | Routing policy is evaluated on lead creation regardless of intake source. Routing team assignment is recorded on the lead. | P0 | Built | SRC-L-001 |
| FR-L-015 | Pulse shall preserve routing history and require a reason for any manual routing override. | Every routing change (initial assignment or override) is logged with actor, timestamp, reason, and prior routing state. | P0 | Built (audit trail) | SRC-L-001 |
| FR-L-016 | Pulse shall support manual reassignment of lead ownership by authorized roles without overwriting prior activity authorship or historical ownership. | Reassignment records the new owner and reason. All prior activity entries retain their original author. Ownership history is viewable on the lead record. | P1 | Partial — reassign action with reason field missing from lead record UI (UX-L-005) | SRC-L-002 |
| FR-L-017 | Pulse shall alert the assigned team when a new lead is routed to them, allowing the team to respond immediately. | In-app alert is generated for the receiving team/owner on lead routing or reassignment. Alert delivery to email/Teams is configurable (pending Microsoft Graph). | P0 | Partial — in-app alert scanning wired; email delivery blocked on Microsoft Graph (SRC-L-009) | SRC-L-002 |

### 9.4 Lifecycle And Pipeline

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|-------------|---------------------|----------|--------------|-----|
| FR-L-018 | Pulse shall maintain a seven-stage pipeline: `new` → `discovery_scheduled` → `discovery_completed` → `cis_sent` → `cis_signed` → `onboarding_completed` → `customer_active`. | All seven stages are present in the system. Stage transitions are logged with timestamps. Stage is visible in list, Kanban, and detail views. | P0 | Built | SRC-L-010 |
| FR-L-019 | Pulse shall support non-linear stage progression where Dynamic AQS requires it (e.g., CIS received before discovery call), while clearly showing incomplete steps. | Steps can be completed out of sequence. Incomplete earlier steps are shown as incomplete without blocking forward progress (configurable by policy). | P1 | Built | SRC-L-002 — Michelle Hogan: "sometimes we'll get a customer information sheet first before the discovery call" |
| FR-L-020 | Pulse shall support backward stage transitions (e.g., returning from `cis_sent` to `discovery_completed`) with a mandatory reason capture. | Backward stage drag on Kanban and stage-change on detail both require the user to provide a reason before the transition is committed. Reason is stored in the audit trail. | P0 | Built | SRC-L-011 — UX-L-011 marked Done |
| FR-L-021 | Pulse shall support a `parked` lifecycle status with reason, and a `closed` lifecycle status with reason. Both must be recoverable (reopenable) by authorized roles. | Parked and closed leads are visually distinct from active leads in list and Kanban views. Authorized users can reopen a parked lead with a reason. Lifecycle badge visible on list rows. | P1 | Partial — lifecycle badge missing on list rows (UX-L-004) | SRC-L-002 |
| FR-L-022 | Pulse shall track time-in-stage for each lead and surface stagnant leads in the workflow queue. | Each lead has a stage-entered timestamp. Stagnant leads (past a configurable threshold) appear in the Urgent/Stagnant workflow queue views. | P1 | Built | SRC-L-006, SRC-L-011 — UX-L-012 marked Done |

### 9.5 Discovery Workflow

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|-------------|---------------------|----------|--------------|-----|
| FR-L-023 | Pulse shall support scheduling a discovery call from within the lead record, with the scheduled event surfaced in the centralized calendar. | "Schedule discovery call" action creates a calendar event linked to the lead. Calendar event is visible in CalendarWorkspace. | P0 | Partial — calendar wiring partially done; UX-L-016 marked Done | SRC-L-001, SRC-L-004 |
| FR-L-024 | Pulse shall record initial-contact events and stop the initial-contact SLA timer when first meaningful contact is logged. | `logLeadInitialContact` service function exists. First contact timestamp is stored. SLA state reflects whether initial contact is within the configured response window. | P0 | Built | SRC-L-006 |
| FR-L-025 | Pulse shall support completing a discovery session and capturing structured discovery outcomes on the lead record. | Discovery completion records outcome, notes, and any qualifying information captured during the session. Lead advances to `discovery_completed` stage on completion. | P0 | Built | SRC-L-006 |
| FR-L-026 | Pulse shall support skipping discovery with an approved reason (fast-track or pre-qualified leads). | Skip discovery records the skip reason. Lead can advance to `cis_sent` stage without completing a formal discovery. Skip reason is stored in the audit trail. | P1 | Built (`skipLeadDiscovery`) | SRC-L-006 |

### 9.6 CIS Workflow

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|-------------|---------------------|----------|--------------|-----|
| FR-L-027 | Pulse shall track the CIS form lifecycle: `not_sent` → `sent` → `received` / `incomplete` → `signed`. | CIS state is visible on the lead record at all times. Status changes are logged with timestamps. CIS panel is accessible from the lead record. | P0 | Built (`LeadCisPanel.tsx`) | SRC-L-001, SRC-L-002, SRC-L-011 |
| FR-L-028 | Pulse shall notify responsible staff (business development team) when a CIS is received, enabling immediate action. | In-app notification generated on CIS receipt. Alert delivery configurable (email/Teams pending Microsoft Graph). | P0 | Partial — in-app alert scanning wired; email blocked on Graph | SRC-L-002 — Michelle Hogan: "it would be nice if that could generate something … approved and come back to the team, just a pop-up message" (SRC-L-003) |
| FR-L-029 | Pulse shall support importing contacts from a received CIS into the lead record (auto-populating contact fields from CIS data). | `importLeadContactsFromCis` function exists in readiness module. Contact fields on the lead record can be populated from CIS data without manual re-entry. | P1 | Built | SRC-L-007 |
| FR-L-030 | Pulse shall track lead finance decision status (credit approval, terms) as part of the CIS workflow. | Finance decision status field exists on the lead. Finance queue view surfaces leads awaiting credit/terms decisions. Authorized finance user can update decision status. | P1 | Built (`LeadFinanceQueue.tsx`, `CisFinanceDecisionStatus`) | SRC-L-003 — Michelle Hogan: "it would be nice if that could generate something to Dan … he could run his process, approve it and it come back to the team" |
| FR-L-031 | Pulse shall not store raw credit-card numbers from the CIS. The system must either route card capture to a PCI-compliant tokenization provider or explicitly prevent card data from being entered. | No database field accepts a raw credit card number. If tokenization integration is active, a token is stored instead. This is a mandatory compliance requirement. | P0 | Partial — card storage prevention is not explicitly enforced in current CIS form (see OQ-L-01); payment provider integration parked | SRC-L-001 — Dan Harshbarger: "we're not in compliance with PCI right now" |

### 9.7 Onboarding Readiness And Conversion

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|-------------|---------------------|----------|--------------|-----|
| FR-L-032 | Pulse shall maintain a lead readiness checklist tracking discovery completion, CIS status, training readiness, and setup completion milestones before first-order conversion. | `LeadReadinessDetail` with checklist items exists. Readiness items can be updated individually. Blockers are surfaced before conversion is permitted. | P0 | Built | SRC-L-007, SRC-L-011 |
| FR-L-033 | Pulse shall validate conversion readiness before converting a lead to an active customer on first order. | `validateLeadConversionPreparation` enforces readiness requirements. Conversion is blocked if critical readiness items are incomplete unless overridden by an authorized role with a reason. | P0 | Built | SRC-L-007 |
| FR-L-034 | Pulse shall convert the lead to a customer record when the first-order activation event is confirmed, not before. | `convertLeadOnFirstOrder` function executes customer record creation. Lead lifecycle status moves to `closed` (converted). Customer/account is created or finalized from the lead data. Acumatica sync is triggered (parked until endpoint certification). | P0 | Built (Pulse side); Acumatica side parked | SRC-L-001 — C G: "a lead until they submit an order, even if they submitted a customer information sheet" |
| FR-L-035 | Pulse shall transfer operational ownership from the business development team to the assigned Territory Manager on first-order conversion. | On conversion, lead ownership record is updated. TM receives notification of new account ownership. Prior BD team activity history is preserved and visible. | P0 | Partial — service function exists; TM notification delivery pending Graph | SRC-L-004 — C G: "once we get that initial order Michelle's team is basically kind of hands off and the territory manager is expected to pick up" |
| FR-L-036 | Pulse shall preserve consignment interest status (and entry timing) on the lead record, allowing consignment onboarding to be triggered either at first-order conversion or at a later point in the customer lifecycle. | `consignmentInterestStatus` (`not_discussed` / `interested` / `approved` / `declined`) and `consignmentEntryTiming` (`at_onboarding` / `later`) fields exist on the lead. Status is visible on the lead record and preserved through conversion. | P1 | Built | SRC-L-010 |

### 9.8 Activity Logging And Audit

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|-------------|---------------------|----------|--------------|-----|
| FR-L-037 | Pulse shall support freeform activity and note logging on the lead record, including call notes, visit notes, email summaries, and general notes. | Activity log is writable from the lead record. Each entry records type (call / email / meeting / note), author, timestamp, and free text. Timeline view shows entries in chronological order. | P0 | Built — UX-L-010 marked Done | SRC-L-001, SRC-L-004 |
| FR-L-038 | Pulse shall maintain a complete audit trail of all stage changes, lifecycle changes, routing decisions, and field updates on the lead record. | Audit trail is accessible from the lead history feed. Each entry includes: actor, timestamp, action type, before/after values, and any recorded reason. | P0 | Built | SRC-L-006 |
| FR-L-039 | Pulse shall support voice-to-text entry for note logging in the mobile app. | Mobile note capture has a microphone/voice input option. Transcribed text is placed in the note field for review before saving. | P1 | Not-built | SRC-L-001 — Michelle Hogan: "voice text option could be available in the lead area as well because a lot of times we're getting a live lead" |

### 9.9 SLA And Alerts

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|-------------|---------------------|----------|--------------|-----|
| FR-L-040 | Pulse shall track initial-contact response time per lead and surface SLA breach state on the lead record when the response window is exceeded. | SLA breach banner appears on the lead hero panel when `slaState.overdue = true`. SLA state is also surfaced in the workflow queue view. | P0 | Partial — SLA breach banner missing on lead hero panel (UX-L-003); workflow queue SLA surfaced | SRC-L-001 |
| FR-L-041 | Pulse shall generate operational alerts for: lead assigned (initial routing), SLA breach (initial contact overdue), discovery overdue, CIS follow-up needed. | Alert records are created by the scanner and visible in-app. Alert delivery to email/Teams is configurable via admin delivery settings. | P0 | Partial — scanner wired; in-app surfacing partially done (UX-L-009); email delivery blocked on Microsoft Graph | SRC-L-009 |
| FR-L-042 | Pulse shall support configurable quiet-hours for alert delivery to avoid sending emails outside business hours. | Admin can configure quiet-hour windows per routing policy. Alerts queued during quiet hours are delivered at the next available window. | P1 | Built | SRC-L-009 |

### 9.10 Pipeline Visibility And Reporting

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|-------------|---------------------|----------|--------------|-----|
| FR-L-043 | Pulse shall provide both a list view and a Kanban (stage column) view of the lead pipeline. | List and Kanban views are selectable in `LeadWorkspace.tsx`. Kanban columns represent the seven pipeline stages. Empty-state prompts are shown when a column has no leads. | P1 | Partial — empty-state missing (UX-L-001, UX-L-002); Kanban otherwise built | SRC-L-001 — C G: "I recall from the demo there was actually a graphical lead pipeline like a kanban view where we could drag and drop" |
| FR-L-044 | Pulse shall provide pipeline insights including time-in-stage metrics, SLA breach trends, pipeline value aggregation, and territory breakdown. | Insights tab surfaces these metrics. Data is computed server-side, not from a client-side 200-row sample. | P1 | Built — UX-L-012 marked Done | SRC-L-011 |
| FR-L-045 | Pulse shall support filtering leads by affinity group, ownership group, source, stage, lifecycle status, territory, and routing team. | All listed filter dimensions are available in the filter panel. Filtered results update the list and Kanban views in real time. | P1 | Built — UX-L-014 marked Done | SRC-L-002 |
| FR-L-046 | Pulse shall support pagination on lead list views. | Lead list is not limited to a hard-coded cap of 200. Pagination controls are visible. Server-side pagination is used. | P0 | Built — UX-L-013 marked Done | SRC-L-011 |

### 9.11 Website Form Management

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|-------------|---------------------|----------|--------------|-----|
| FR-L-047 | Pulse shall provide a website form management workspace allowing configuration of intake forms per brand/website, including field visibility, required-field settings, and allowed-origins list. | Admin can create and configure website lead forms in `LeadWebsiteFormsWorkspace.tsx`. Each form has a unique endpoint. Allowed-origins enforcement is configurable. | P0 | Built | SRC-L-011 |
| FR-L-048 | Pulse shall provide a form preview and test-submission capability for configured website forms. | Admin can preview the form as a customer would see it and submit a test submission without creating a production lead record. | P1 | Built — UX-L-015 marked Done | SRC-L-011 |
| FR-L-049 | Pulse shall provide an embeddable public-facing website lead capture form that can be placed on any of the 16+ Dynamic AQS branded websites. | `PublicWebsiteLeadCaptureForm.tsx` renders the form. Submissions are validated against the site-specific form config and create `WebsiteLeadSubmission` records. | P0 | Built | SRC-L-011 |

---

## 10. NON-FUNCTIONAL REQUIREMENTS

| ID | Requirement | Target | Source |
|----|-------------|--------|--------|
| NFR-L-01 | Lead list page load time | Lead list and Kanban view must render within 3 seconds on a standard broadband connection with up to 500 active leads in scope. | (inferred standard) |
| NFR-L-02 | Website form submission latency | Website lead submission must be acknowledged (HTTP 200 or validation error) within 5 seconds of form submit, even under moderate load. | (inferred standard) |
| NFR-L-03 | Import commit throughput | A 1,000-row roster import preview must complete within 30 seconds. Commit must complete within 60 seconds. | SRC-L-004 — roster size confirmed as 300–1,000 records |
| NFR-L-04 | OCR capture response | OCR extraction preview must return candidate fields within 10 seconds of image upload on a 4G mobile connection. | (inferred standard) |
| NFR-L-05 | Role-based data isolation | A Territory Manager user must only see leads scoped to their territory/assignment. Isolation must be enforced server-side (`resolveLeadRecordScope`). A TM cannot see leads in another territory by manipulating URL parameters or API calls. | SRC-L-006 — `resolveLeadRecordScope` in service |
| NFR-L-06 | PCI compliance | No raw payment-card number may be persisted in any Pulse database table, log, or file store. The CIS intake form must not include a card-number input field unless a PCI-compliant tokenization provider is active and the data never touches Pulse storage in unencrypted form. | SRC-L-001 — Dan Harshbarger: "we need to tokenize it and save a token" |
| NFR-L-07 | Alert delivery auditability | Every operational alert generated by the scanner must be persisted with a deduplication key before delivery is attempted. Delivery failures must be logged and retryable by an admin without data loss. | SRC-L-009 |
| NFR-L-08 | Audit trail completeness | Every stage transition, lifecycle status change, routing decision, and assignment must produce an immutable `AuditEntry` record with actor, timestamp, and before/after state. Audit entries cannot be deleted by any non-super-admin role. | SRC-L-001 (BR-L-05, BR-L-10) |
| NFR-L-09 | Data retention | All lead records (including closed/converted leads), activity logs, import run records, and audit entries must be retained for a minimum of 7 years. | (inferred standard) |
| NFR-L-10 | Availability | The lead intake endpoints (website form submission) must target 99.5% monthly uptime. Downtime of the intake endpoint must not cause silent lead loss — submissions must be queued or rejected with a user-visible error. | (inferred standard) |
| NFR-L-11 | Accessibility | Lead pipeline views, intake forms, and the lead record detail must meet WCAG 2.1 AA standards. | (inferred standard) |
| NFR-L-12 | Observability | Server-side lead service operations (create, import, transition, alert scan) must emit structured logs and metrics that can be monitored for error rate, latency, and throughput in the operational monitoring stack. | (inferred standard) |
| NFR-L-13 | Scalability | The leads module architecture must support at least 50,000 total lead records (active + closed) without degradation to list/filter response times beyond the targets in NFR-L-01. | (inferred — based on growth trajectory) |

---

## 11. ASSUMPTIONS

| ID | Assumption | Why It Matters |
|----|------------|----------------|
| ASM-L-01 | The primary routing split is based on service-tech / truck-count threshold (currently 5), and the Strategic Growth team handles leads below the threshold. This threshold is configurable via the admin routing policy. | Routing logic, queue ownership, and leadership reporting depend on this threshold. If the basis changes (e.g., geography-first), routing must be reconfigured. |
| ASM-L-02 | Strategic Growth handling is a distinct ownership path for smaller or designated prospects, separate from TM/national handling. | This changes lead ownership, alerts, and follow-up responsibility for all leads below threshold. |
| ASM-L-03 | Affinity-group and ownership-group classification will be captured as early as possible at intake, but "unknown" is a valid review-state that does not block intake. Classification must be resolved before CIS stage at the latest. | Downstream onboarding and pricing logic depends on early classification. |
| ASM-L-04 | A prospect will remain a lead until the first order is submitted or until Dynamic AQS confirms an alternative customer-activation boundary. The CIS form alone does not convert a lead to an active customer. | This affects Acumatica sync timing, customer record creation, and dealer portal access provisioning. |
| ASM-L-05 | Website submissions may begin with lighter data than internal manual entries, but will still enter the same governed pipeline. | Validation rules and required-field configuration must accommodate lighter website intake without creating downstream data quality issues. |
| ASM-L-06 | Mobile business-card and badge capture belongs in the lead-intake scope and uses the same routing, classification, and duplicate-check backbone as all other intake paths. | This affects module ownership and field/mobile parity. |
| ASM-L-07 | The Microsoft Graph / Office 365 credentials required for email alert delivery will be certified and made available before the lead alert delivery feature goes live. Until then, alerts persist in `PENDING` state and are surfaced in-app only. | Alert delivery emails to TMs and leadership depend on this credential availability. |
| ASM-L-08 | The Acumatica first-order integration endpoint will be certified before the `convertLeadOnFirstOrder` Acumatica sync leg goes live. Until then, Pulse creates the customer record but does not push to Acumatica. | ERP activation requires this endpoint. The Pulse-side conversion logic is already built. |
| ASM-L-09 | Affinity-group roster files will be available in CSV or XLSX format from group administrators. The column structure may differ across groups but will always include at minimum: company name, primary contact, email, state. | Import mapping tooling must handle variable column structures. |
| ASM-L-010 | Historical lead data in HubSpot will be migrated as a one-time cutover operation under a separate migration plan. This PRD covers the operational target state only, not the migration mechanics. | Lead count and pipeline accuracy at go-live depend on the migration plan being executed correctly. |

---

## 12. OPEN QUESTIONS

| # | Question | Options To Confirm | Why Decision Is Needed |
|---|---|---|---|
| OQ-L-01 | What is the approved approach to credit-card handling on the CIS form? | (a) Block card input entirely — customer enters card directly in Acumatica / tokenization provider; (b) Integrate a PCI-compliant tokenization provider in the CIS form to capture a token only; (c) CIS is card-free and card is collected separately at order time | Pulse must not store raw card data. Current behavior (paper CIS with card numbers attached to PDF) is a confirmed PCI compliance risk (SRC-L-001 — Dan Harshbarger). A decision is needed before the digital CIS form design is finalized. |
| OQ-L-02 | What is the final routing basis and threshold? | service-tech count / truck count / other approved rule; currently assumed at 5 | Pulse should not lock routing behavior on an incorrect business basis. |
| OQ-L-03 | How should Strategic Growth ownership behave? | pooled team ownership / named owner / round-robin / affinity-based override | This changes assignment visibility and alerting. |
| OQ-L-04 | What is the approved duplicate-resolution policy? | attach to existing / create anyway / review queue / merge-on-approval | This changes lead quality and customer history integrity. |
| OQ-L-05 | When is "unknown / not yet assessed" acceptable for classification? | public intake only / temporary review state / never acceptable / other | This changes intake UX and downstream data quality. |
| OQ-L-06 | Is discovery mandatory for every lead? | always required / skippable with reason / allowed fast-track by role | This changes stage rules and calendar behavior. |
| OQ-L-07 | How should homeowner or non-dealer inquiries be treated? | same pipeline / filtered queue / separate intake type / redirect | This changes whether all website traffic belongs in the same revenue workflow. |
| OQ-L-08 | At what point should dealer portal access be provisioned — CIS receipt or first order? | CIS triggers portal setup (Adrienne Cardinale's position, SRC-L-001) vs. first order only (C G's initial position, SRC-L-001) | Portal provisioning timing affects whether customers can browse products before placing their first order. Remains open from 16 Feb 2026 session. |
| OQ-L-09 | Should voice-to-text note entry be included in the mobile app as a P0 or P1 feature for the first release? | P0 (required for TM adoption) / P1 (nice to have) / deferred | Adoption risk if note entry remains cumbersome on mobile (Don Hearn + Michelle Hogan, SRC-L-001). |
| OQ-L-10 | What alert channels should accompany lead ownership and SLA escalation? | in-app only / email via Microsoft Graph / Teams / mixed by role | This changes follow-up behavior and provider dependencies. Microsoft Graph is currently the only email delivery path wired. |

---

## 13. Later-Phase / Separate Decision Items

These items may still belong in the broader Pulse roadmap, but will not be assumed as finalized by this PRD:

- advanced marketing attribution and campaign performance analysis
- social-media-native lead capture
- broader field-selling and route-selling actions from mobile
- deeper predictive scoring and forecasting models
- HubSpot historical migration rules beyond the one-time cutover decision
- credit-card tokenization integration (payment provider dependency)
- Acumatica first-order activation (endpoint certification dependency)
- Microsoft Graph email delivery for lead alerts (provider credentials dependency)

---

## 14. Approval Checklist

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

## 15. Requirement → Source Traceability Matrix

| Requirement ID | SRC ID(s) | Session(s) |
|---|---|---|
| FR-L-001 | SRC-L-001, SRC-L-005, SRC-L-006, SRC-L-011 | 16 Feb 2026, PRD-Lead-To-Dealer |
| FR-L-002 | SRC-L-002, SRC-L-006 | 18 Feb 2026 |
| FR-L-003 | SRC-L-004, SRC-L-006, SRC-L-011 | 24 Feb 2026 |
| FR-L-004 | SRC-L-004 | 24 Feb 2026 |
| FR-L-005 | SRC-L-001, SRC-L-008 | 16 Feb 2026 |
| FR-L-006 | SRC-L-001, SRC-L-002, SRC-L-011 | 16 Feb 2026, 18 Feb 2026 |
| FR-L-007 | SRC-L-001, SRC-L-002 | 16 Feb 2026, 18 Feb 2026 |
| FR-L-008 | SRC-L-002, SRC-L-006, SRC-L-011 | 18 Feb 2026 |
| FR-L-009 | SRC-L-001, SRC-L-002 | 16 Feb 2026, 18 Feb 2026 |
| FR-L-010 | SRC-L-002 | 18 Feb 2026 |
| FR-L-011 | SRC-L-002 | 18 Feb 2026 |
| FR-L-012 | SRC-L-002 | 18 Feb 2026 |
| FR-L-013 | SRC-L-002 | 18 Feb 2026 |
| FR-L-014 | SRC-L-001 | 16 Feb 2026 |
| FR-L-015 | SRC-L-001 | 16 Feb 2026 |
| FR-L-016 | SRC-L-002 | 18 Feb 2026 |
| FR-L-017 | SRC-L-002 | 18 Feb 2026 |
| FR-L-018 | SRC-L-010 | 16 Feb 2026, 18 Feb 2026 |
| FR-L-019 | SRC-L-002 | 18 Feb 2026 |
| FR-L-020 | SRC-L-011 | (UX audit) |
| FR-L-021 | SRC-L-002 | 18 Feb 2026 |
| FR-L-022 | SRC-L-006, SRC-L-011 | (code + UX audit) |
| FR-L-023 | SRC-L-001, SRC-L-004 | 16 Feb 2026, 24 Feb 2026 |
| FR-L-024 | SRC-L-006 | (service code) |
| FR-L-025 | SRC-L-006 | (service code) |
| FR-L-026 | SRC-L-006 | (service code) |
| FR-L-027 | SRC-L-001, SRC-L-002, SRC-L-011 | 16 Feb 2026, 18 Feb 2026 |
| FR-L-028 | SRC-L-002, SRC-L-003 | 18 Feb 2026, 20 Feb 2026 |
| FR-L-029 | SRC-L-007 | (readiness code) |
| FR-L-030 | SRC-L-003 | 20 Feb 2026 |
| FR-L-031 | SRC-L-001 | 16 Feb 2026 |
| FR-L-032 | SRC-L-007, SRC-L-011 | (readiness code + UX) |
| FR-L-033 | SRC-L-007 | (readiness code) |
| FR-L-034 | SRC-L-001, SRC-L-007 | 16 Feb 2026 |
| FR-L-035 | SRC-L-004 | 24 Feb 2026 |
| FR-L-036 | SRC-L-010 | (contracts) |
| FR-L-037 | SRC-L-001, SRC-L-004 | 16 Feb 2026, 24 Feb 2026 |
| FR-L-038 | SRC-L-006 | (service code) |
| FR-L-039 | SRC-L-001 | 16 Feb 2026 |
| FR-L-040 | SRC-L-001 | 16 Feb 2026 |
| FR-L-041 | SRC-L-009 | (alerts code) |
| FR-L-042 | SRC-L-009 | (alerts code) |
| FR-L-043 | SRC-L-001, SRC-L-002 | 16 Feb 2026, 18 Feb 2026 |
| FR-L-044 | SRC-L-006, SRC-L-011 | (code + UX audit) |
| FR-L-045 | SRC-L-002 | 18 Feb 2026 |
| FR-L-046 | SRC-L-011 | (UX audit) |
| FR-L-047 | SRC-L-011 | (component build) |
| FR-L-048 | SRC-L-011 | (component build) |
| FR-L-049 | SRC-L-001, SRC-L-011 | 16 Feb 2026 |
| NFR-L-01 through NFR-L-13 | SRC-L-001 through SRC-L-011 as cited above | Various sessions |

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

---

## Revision Notes

- **2026-04-20**: v2.0 scope confirmation draft published.
- **2026-06-09**: v3.0 traceability closure pass. Added: Meeting Traceability header; SRC-L-001 through SRC-L-011 source inventory; FR-L-001 through FR-L-049 functional requirements with acceptance criteria, priority, build status, and SRC citations; NFR-L-01 through NFR-L-13 non-functional requirements; ASM-L-01 through ASM-L-010 assumptions; OQ-L-01 through OQ-L-10 open questions (consolidating existing Q-L-01 through Q-L-07 and adding three new questions); requirement-to-source traceability matrix. BR-L-11 through BR-L-14 added from discovery transcript evidence. §UX-GAPS section preserved verbatim from v2.0 audit.
