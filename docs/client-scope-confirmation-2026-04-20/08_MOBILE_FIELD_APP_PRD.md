# Pulse Platform — Mobile Field App PRD

## 1. Document Control

| Field | Value |
|---|---|
| Version | 2.7 |
| Date | 2026-06-19 |
| Status | Order-on-behalf delivery (2026-06-19): the buildable-now CRM `OrderDraft` flow for FR-MOB-047 is COMPLETE on the CRM side — backend ORD-P1–P3, mobile capture UI ORD-P4, web back-office triage queue ORD-P6, and the flag-gated first-order conversion signal ORD-P5 — see the §BUILD note below; only the Acumatica-gated order placement remains parked. Builds on v2.4's scope-accuracy corrections and v2.3's route-optimization build reconciliation |
| Module owner | Pulse delivery team |
| Primary reviewers | Dynamic AQS field leadership, Territory Managers, Regional Directors, operations lead |
| Related documents | `00_README_AND_MEETING_AGENDA.md`, `01_LEADS_PRD.md`, `02_TRAINING_PRD.md`, `03_TERRITORY_PRD.md`, `04_CALENDAR_PRD.md`, `05_CONSIGNMENT_PRD.md` |

---

## Meeting Traceability

| Session | Date | Key Speakers | Topics Sourced |
|---|---|---|---|
| Session 1 — Executive Vision, Objectives & Mobile Strategy | Feb 16 2026 | CG (Currie), Dan (VP Finance & Ops), Steve (Divisional President), Michelle (VP BD), Adrienne (Dir. Partnerships) | Core mobile app requirements: voice-to-text, training, visit logging, offline capability, route planning; Map My Customer replacement rationale; integration priorities |
| Session 10 — To-Be Consignment and App | Mar 17 2026 | CG (Currie), Don Hearn, Samantha Marks, Adrienne Cardinale, Ahmad Hassan | Mobile ROSE audit flow; check-in/check-out; check-out notes enforcement; colour-coded map pins; territory manager view; consignment audit tab; voice note; calendar sync; order submission from mobile; navigation handoff (Google Maps / Apple Maps / Waze); signature optional/required policy; tablet support |
| Session 13 — April 20 scope review | Apr 20 2026 | CG (Currie), Faraz Sohail, Ahmad Hassan | Map My Customer replacement confirmation; voice-to-text notes; mobile-first design philosophy; app = Pulse CRM native app (not a standalone product) |

---

## 2. Source Inventory

| ID | Absolute Path | What It Sourced |
|---|---|---|
| SRC-MOB-001 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Discovery Session 1_ Executive Vision, Objectives & Mobile Strategy.md` | Core feature set (Section 3): voice-to-text, training management, visit logging, offline, route planning; integration priority list; user adoption discussion; Map My Customer replacement |
| SRC-MOB-002 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/17th March  session 10-To-Be consognment and App.md` | App demo walkthrough; check-in/check-out flow; checkout notes required; colour-coded map pins; filter/toggle for account types; territory polygon view; consignment audit on mobile; ROSE audit signature optionality; calendar sync (Outlook); order submission from mobile; navigation handoff; voice note; TM account detail + history view; Regional Director high-level dashboards; tablet support confirmed |
| SRC-MOB-003 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/session-13th-20thApril-2026.md` | Map My Customer replacement reconfirmed; voice-to-text notes; mobile-first philosophy; ease of use; Pulse app = CRM native companion |
| SRC-MOB-004 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Discovery Session 1 - 16th Feb 2026.md` | Parallel session corroborating mobile feature requirements; existing CRM mobile app not adopted; Map My Customer widely used; training logging gap |
| SRC-MOB-005 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/mobile/app/(tabs)/_layout.tsx` | Built tab navigation contract (Today, Route, Consignment, More as first-class tabs; Leads/Training/VoiceNotes behind More/href:null) |
| SRC-MOB-006 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/mobile/app/(tabs)/index.tsx` | Built Today home screen: ranked next-action card, day agenda strip, overdue ROSE badge, metric strip, live-CRM-data panel |
| SRC-MOB-007 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/mobile/src/hooks/use-consignment-rose-audit.ts` | Built ROSE audit hook: 5-step gated flow, line counts, variance preview, evidence capture, attestation, draft fallback |
| SRC-MOB-008 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/mobile/app/(tabs)/route.tsx` | Built route/visit screen: accounts ordered by oldest last-touch, GPS capture, check-in, checkout notes required, draft fallback |
| SRC-MOB-009 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/mobile/app/(tabs)/voice-notes.tsx` | Built voice-note screen: title + transcript, context selection, submit |
| SRC-MOB-010 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/mobile/app/ocr-capture.tsx` | Built OCR capture: camera / gallery / pasted text, preview with confidence, "Create lead" path dead-ends (UX-M-008 open) |
| SRC-MOB-011 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/mobile/app/sync-status.tsx` | Built sync-status screen (My Work inventory) |
| SRC-MOB-012 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/mobile/src/lib/mobile-draft-queue.ts` | Built draft model types: MobileDraftKind, MobileDraftStatus, MobileDraftQueueSummary |
| SRC-MOB-013 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/mobile/src/lib/mobile-next-action.ts` | Built next-action ranking engine and action kinds |
| SRC-MOB-014 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/mobile/src/lib/api-base-url.ts` | Built API-host allowlist and HTTPS restriction |
| SRC-MOB-015 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/mobile/app/lead/[id].tsx` | Built lead detail with UX-M-005 call-disposition and stage-change panels |
| SRC-MOB-016 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/mobile/app/account/[id].tsx` | Built account detail with UX-M-006 quick visit-log |
| SRC-MOB-017 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/mobile/src/lib/today-metrics.ts` | Built overdue ROSE site count helper |
| SRC-MOB-018 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/mobile/app/(tabs)/more.tsx` | Built More screen: Voice Notes primary, OCR and Sync Status secondary, queue shortcuts |
| SRC-MOB-019 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/mobile/app/training.tsx` | Built training execution: 5-step flow, attendee count, proof photos, follow-up task, draft fallback |
| SRC-MOB-020 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/MOBILE_UX_DISCOVERY_AND_GAP_ANALYSIS.md` | Field-UX gap analysis: dark/high-contrast outdoor theme, accessibility labels + Dynamic Type, offline conflict-resolution UI, optimistic submit, thumb-zone ergonomics, skeleton states |
| SRC-MOB-021 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/mobile/app/(tabs)/map.tsx` | Built MapLibre map view: status-derived colour-coded account markers, account-type filter toggles, territory overlay (precise marker geo stubbed via deterministic hash pending server lat/lng) |
| SRC-MOB-022 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/mobile/app/(tabs)/calendar.tsx` | Built calendar view: real custom month-matrix grid with month navigation and per-day work, beyond the Today day-agenda strip |
| SRC-MOB-023 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24 Feb 2026 Discovery session 4.md` | Added 2026-06-18 (scope audit): route-builder source — Don's Map My Customer route requirements (per-stop dwell 1–60 min, end-of-day arrival prediction "you're gonna be at your hotel by seven o'clock", multiple/saved routes) backing FR-MOB-061 and FR-MOB-034; previously referenced in the prose but missing from the Source Inventory |

---

## Scope corrections (2026-06-18)

The following LOW-severity scope-accuracy corrections were applied after the program-wide re-check of client-attributed requirements against the cited meeting transcripts. No rows were deleted; substance is unchanged.

- **FR-MOB-060 (tap-to-call) — speaker re-attribution.** The requirement was sourced to "CG/Don, Session 10"; in the transcript only CG describes the click-to-call behaviour (Session 10: *"I need to call Joe Smith … it calls Joe"*). Attribution corrected to **CG only** (not Don). The device click-to-call need is client-confirmed.
- **FR-MOB-060 — "optional per-call auto-log as a disposition" is design-inferred.** The auto-log-as-disposition elaboration is a vendor/design inference, not a client-stated requirement; it is not in the cited transcript. It remains a reasonable design choice but is no longer presented as client-confirmed.
- **Source Inventory — Session 4 (24 Feb 2026) added (SRC-MOB-023).** Session 4 backs the route-builder requirements (FR-MOB-061 / FR-MOB-034) in the PRD prose (Don: per-stop dwell 1–60 min, end-of-day arrival prediction, multiple/saved routes) but was not previously listed as a source. It has been added.

Full audit: `docs/SCOPE_ACCURACY_AUDIT_2026-06-18.md`.

---

## 3. Executive Summary

The Mobile Field App is the field-execution companion to Pulse CRM — not a standalone product and not a second copy of the web platform. It is the surface a Territory Manager or Regional Director opens in the truck, on a dealer shelf, and between stops to see what matters today, do the on-site work, and let that work flow back into Pulse cleanly. The app is built in React Native / Expo and shares the same governed API contracts as Pulse web, so every field action lands in the same operational truth the office sees.

The app today centres on a ranked "Today" home, a route/visit check-in flow, an on-site ROSE consignment audit, training execution, voice-note and business-card capture, and a phone-saved draft model that protects field work when signal is weak. It deliberately does the heavy back-office work — CIS administration, finance approval, account setup, warehouse creation in Acumatica, reporting administration — nowhere on mobile; those stay web-first. The goal of this module is to give the field one connected tool that is faster than paper, Outlook, and after-the-fact CRM entry, while never silently losing work done off-grid.

---

## 4. Module Objective

Pulse Mobile will give field users one field-execution tool that will:

- open on a ranked "Today" home that names the single most important next action
- surface the field user's live queues — leads, accounts, ROSE audits, route stops — from CRM
- let a Territory Manager run an on-site ROSE consignment audit with the data-quality gates the office needs
- let a field user execute and complete a training session in the field
- let a field user check in and check out of an account visit and have it recorded against CRM
- capture voice notes and business cards for office review without forcing on-the-spot data entry
- protect field work with one clear phone-saved draft model when CRM is unreachable, and let the user retry when signal returns
- keep all field work inside the same governed routing, attribution, and audit rules used by Pulse web

---

## 5. Scope Statement

### 5.1 Pulse Mobile Will Support

- a default "Today" home with one ranked **Start here** next-action card, priority leads, a metric strip (Open actions / SLA risk / ROSE / Accounts), nearby accounts, and a live-CRM-data status panel
- a first-class bottom-tab navigation contract covering the daily field surfaces (see Section 7.2)
- a persistent header bell / notifications center that badges phone-saved drafts and surfaces field signals (urgent leads, SLA risk, due ROSE audits, consignment work)
- a lead inbox with search and a lead detail surface for field context
- an account list with search, account detail, and an embedded training context panel
- a route plan surface that orders nearby work and supports on-site check-in / check-out written through the CRM site-visit model, with a phone-saved draft fallback
- a ROSE consignment audit flow with a 5-step gated workflow: counts → notes → evidence → attest → submit, including line-item counts with live variance preview
- consignment evidence capture (camera / gallery, general vs. discrepancy purpose) uploaded with the audit when CRM is reachable
- a training execution flow with a 5-step workflow: check in → details → proof → follow-up → submit, including attendee count and proof-photo upload
- voice-note capture (record, edit transcript, choose CRM/account context, sync for office review)
- business-card OCR capture that previews extracted lead fields and routes them into the governed lead workflow
- a single canonical phone-saved draft / sync-state model and one "my work" inventory surfaced through a Sync Status review screen
- a configurable, host-restricted API base URL for approved environments (production / local QA)
- foreground GPS capture for visit evidence, with a timed-only fallback when location permission is unavailable

### 5.2 Out-of-Scope (Web-First)

Back-office work that remains web-first and is explicitly excluded from the mobile app:
- CIS form administration and credit approval workflows
- Finance approval flows and invoice management
- Account setup and Acumatica warehouse creation
- Consignment reporting administration, KPI dashboards
- Full ROSE back-office reconciliation drilldown and missing-item investigation tools

### 5.3 Parked / Separate-Decision Dependencies

These items are part of the broader Pulse field vision but require a separate signed dependency decision before they are built. They are explicitly **not** assumed by this PRD:

- **Acumatica live inventory / SKU truth** — expected ROSE counts may be missing or stale until the Acumatica read integration is approved; the field flow must not block on it
- **Barcode / SKU scanning** — parked until product-mapping signoff; ROSE lines display SKU/barcode for reference only
- **Offline photo byte storage** — drafts are metadata-only by design today; no media bytes, base64, file URIs, or storage keys are persisted offline
- **Push notifications and deep links** — provider and notification governance not yet selected
- **Background upload / background sync worker** — sync is foreground/manual today
- **Route geographic optimization and geofencing** — interim ordering is by oldest last-touch; provider/rules decision pending
- **Acumatica warehouse creation, PO posting, and finance reconciliation** — back-office, web-first, outside the mobile app
- **Outlook calendar bi-directional sync** — Microsoft Graph dependency not yet certified; calendar events shown via Pulse calendar API only

---

## 6. Primary Future-State User Journeys

### 6.1 Journey A — Field User Opens "Today" And Starts The Right Work

1. The field user opens the app and lands on the "Today" home.
2. Pulse ranks route, lead, ROSE, and phone-saved work into one **Start here** next-action card.
3. The user sees priority leads, a metric strip (open actions, SLA risk, ROSE, accounts), and nearby accounts.
4. A live-CRM-data panel shows whether each section loaded, loaded partially, or failed.
5. The user taps the next action and is taken directly into the relevant flow.

### 6.2 Journey B — Territory Manager Runs An On-Site ROSE Audit

1. The TM opens the Consignment tab or a notification and selects a due ROSE site.
2. Pulse loads the scheduled audit and shows the expected-count source and its freshness.
3. **Step 1 — Counts:** the TM enters the physical count for each ROSE line; variance previews per line and in total.
4. **Step 2 — Notes:** the TM adds the short audit note the office needs.
5. **Step 3 — Evidence:** the TM attaches optional photos; a variance requires at least one discrepancy photo.
6. **Step 4 — Attest:** the TM types their name and confirms the on-site attestation.
7. **Step 5 — Submit:** Pulse uploads evidence and submits counts to CRM; CRM opens discrepancy / PO follow-up where variance exists. If CRM is unreachable, the audit is saved as a phone draft with counts, notes, attestation, and photo metadata.

### 6.3 Journey C — Field User Executes A Training Session

1. The user opens Training from the tab bar, Today quick action, account context, or a notification.
2. **Check in:** the user checks in to a scheduled session; CRM records the check-in.
3. **Details:** the user records attendee count and completion notes.
4. **Proof:** the user captures proof photos (camera/gallery) and proof-context notes.
5. **Follow-up:** the user optionally creates a follow-up task.
6. **Submit:** the session is completed back to CRM, or saved as a training phone draft if CRM is unreachable.

### 6.4 Journey D — Field User Checks In And Out Of An Account Visit

1. The user opens Route Plan and sees nearby work ordered by oldest last-touch.
2. The user starts a visit; the visit begins immediately on the phone and is created/checked-in through the CRM site-visit model.
3. GPS is captured when permission is granted; otherwise the visit is timed-only.
4. At checkout the user must enter notes; the visit is completed in CRM, or saved as a route phone draft to retry later.

### 6.5 Journey E — Field User Captures A Business Card As A Lead

1. The user opens card capture and uses camera, gallery, or a pasted-text fallback.
2. Pulse previews the extracted lead fields with per-field confidence and review reasons.
3. The user reviews the fields with the dealer or prospect.
4. The user commits the candidate into the governed CRM lead review queue, where duplicate review, classification, routing, and source attribution apply (see OQ-MOB-01).

### 6.6 Journey F — Field User Captures A Voice Note

1. The user opens Voice Notes from the tab bar or a Today quick action.
2. The user records audio and edits the transcript text.
3. The user chooses a general CRM context or a specific account.
4. The note is structured and synced to Pulse CRM for office review. Automatic writeback into lead/account/training/consignment records is parked (see ASM-MOB-05).

### 6.7 Journey G — Field User Loses Signal And Recovers Work

1. The user completes ROSE, training, or route work while offline or on weak signal.
2. Pulse saves the work as a **Saved on phone** draft and confirms it only after durable phone storage has accepted it.
3. The header bell badges the unsynced count; the Sync Status screen lists each draft with what is saved and what it will do on retry.
4. When signal returns, the user retries; on success the item becomes **CRM saved** and leaves the draft inventory.

---

## 7. Functional Requirements

### 7.1 Today Home And Field Orientation

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-MOB-001 | The app shall open on a "Today" home as the default landing surface for every field session | First screen after login is the Today tab; no rerouting on subsequent opens | P0 | Built | SRC-MOB-001, SRC-MOB-006 |
| FR-MOB-002 | Today shall present exactly one ranked **Start here** next-action card drawn from route, lead, ROSE, and phone-saved work | One card visible per session; tapping navigates to relevant flow | P0 | Built | SRC-MOB-001, SRC-MOB-006, SRC-MOB-013 |
| FR-MOB-003 | Today shall show priority leads, a four-tile metric strip (open actions / SLA risk / ROSE / accounts), and nearby accounts for fast context | Four metric tiles present; nearby accounts section loads independently | P0 | Built | SRC-MOB-001, SRC-MOB-006 |
| FR-MOB-004 | Today shall show a live-CRM-data panel reporting section-level load status (ready / partial / failed) so a single failing endpoint never blanks the workspace | Each section degrades independently; failed sections show error state, others remain usable | P0 | Built | SRC-MOB-001, SRC-MOB-006 |
| FR-MOB-005 | Today shall surface an overdue ROSE audit count and SLA breach badge derived from already-fetched field data without requiring a push provider | Overdue ROSE count badge visible on Today metric strip when >0 | P0 | Built (UX-M-007) | SRC-MOB-006, SRC-MOB-017 |
| FR-MOB-006 | Today shall show a day-agenda strip of up to 5 calendar events for the current day | Agenda strip renders calendar events; best-effort (never blocks Today) | P1 | Built (UX-M-004) | SRC-MOB-001, SRC-MOB-006 |

### 7.2 Navigation Contract

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-MOB-007 | The app shall implement one explicit bottom-tab navigation contract: Today, Route, Consignment, and a More launcher as visible first-class tabs; Training, Leads, Accounts, Voice Notes accessible from More | Tab bar shows Today / Route / Consign / More labels; core daily queues reachable within 2 taps | P0 | Built — partial (a 1-tap "Lead inbox" shortcut now sits on Today so the Leads queue is never buried — commit fb7f5d8; the bottom-tab composition itself, Q-M-02, remains a product decision) | SRC-MOB-005, SRC-MOB-018 |
| FR-MOB-008 | The app shall show a persistent header bell across all surfaces that badges the count of phone-saved drafts and opens the notifications center on tap | Bell visible on every screen header; badge reflects unsynced draft count | P0 | Built | SRC-MOB-005, SRC-MOB-006 |
| FR-MOB-009 | The app shall support both smartphone and tablet (iPad) form factors | Layout adapts to iPad screen; confirmed by CG Session 10 | P1 | Built — partial (responsive content width: the shared Screen/ListScreen now cap + centre the content column on iPad via a unit-tested width hook — commit 538a95b; pixel/device verification of the tab bar in landscape, hero gradients, and safe-area insets still needs a simulator). Reconciles with NFR-MOB-013 and ASM-MOB-09, which previously stated iPad support differently | SRC-MOB-002 |

### 7.3 ROSE Consignment Audit

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-MOB-010 | Pulse Mobile shall load due/active ROSE consignment sites and the scheduled audit from CRM | Consignment tab shows ROSE sites sorted by due date; no manual refresh required on open | P0 | Built | SRC-MOB-007, SRC-MOB-002 |
| FR-MOB-011 | Pulse Mobile shall show the expected-count source and freshness, and require manual verification when the source is parked or stale | Stale/parked source warning visible before counting begins (UX-M-003 open) | P0 | Built (explicit parked-vs-stale-vs-fresh source classification now drives the site-card pill + ROSE step-1 guidance — commit fb7f5d8; a durable "stale" signal still depends on the Acumatica sync feed — UX-M-003) | SRC-MOB-007, SRC-MOB-002 |
| FR-MOB-012 | Pulse Mobile shall present a 5-step gated ROSE workflow: counts → notes → evidence → attest → submit, where each step gate must be satisfied to advance | Each step requires completion before advance; skipping blocked in UI | P0 | Built | SRC-MOB-007 |
| FR-MOB-013 | Pulse Mobile shall support line-item counts with per-line and total variance preview before any counting begins | Variance preview renders per line and as total; displayed before submission | P0 | Built | SRC-MOB-007, SRC-MOB-002 |
| FR-MOB-014 | A variance in the ROSE audit shall require at least one discrepancy-purpose evidence photo before the user can attest and submit | Submit is gated until variance evidence photo is attached | P0 | Built (BR-M-03) | SRC-MOB-007 |
| FR-MOB-015 | Pulse Mobile shall capture general and discrepancy evidence photos and upload them with the audit when CRM is reachable; when CRM is unreachable, photo metadata shall be stored in the draft | Evidence photos present in audit submission; metadata stored offline | P0 | Built | SRC-MOB-007 |
| FR-MOB-016 | Pulse Mobile shall require a typed attestation name and attestation confirmation before the audit can be submitted | Submit is blocked until `attestedByName` and `isAttested` are both set | P0 | Built | SRC-MOB-007, SRC-MOB-002 |
| FR-MOB-017 | A balanced ROSE count shall submit as a confirmed true-up; a shortage or overage shall submit as an open reconciliation so PO/discrepancy follow-up remains visible in the back office | CRM receives `reconciliationStatus` reflecting balanced vs. open outcome | P0 | Built (BR-M-04) | SRC-MOB-007 |
| FR-MOB-018 | ROSE audit shall be saveable as a phone draft when CRM is unreachable; the draft shall include counts, notes, attestation, and photo metadata, and shall retry when the user taps retry | Draft persists after app close; retry submits full audit payload | P0 | Built | SRC-MOB-007, SRC-MOB-012 |
| FR-MOB-019 | ROSE lines shall display SKU/barcode for reference; camera-based barcode scanning is parked pending product-mapping signoff | SKU/barcode displayed as text; no scan button unless signoff received | P1 | Parked (barcode scanning) | SRC-MOB-001, SRC-MOB-002 |
| FR-MOB-020 | Customer/dealer signature on the ROSE audit shall be optional; only the initial BLUE form (agreement/baseline) requires mandatory signatures | ROSE submit does not block on customer signature; BLUE form blocks until signed | P0 | Built (Samantha: "optional as a validation"; CG: "review and submit rather than review and sign") | SRC-MOB-002 |

### 7.4 Training Execution

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-MOB-021 | Pulse Mobile shall load formal training sessions and show scheduled / checked-in / overdue counts | Training screen shows session list with status pills | P0 | Built | SRC-MOB-019, SRC-MOB-001 |
| FR-MOB-022 | Pulse Mobile shall present a 5-step training workflow: check in → details → proof → follow-up → submit | Each step requires completion before advance | P0 | Built | SRC-MOB-019 |
| FR-MOB-023 | The training flow shall capture attendee count and completion notes with clear required-field guidance | Attendee count and notes fields required before submit | P0 | Built | SRC-MOB-019, SRC-MOB-001 |
| FR-MOB-024 | The training flow shall support proof-photo upload (camera/gallery) within mobile caps | Proof photos attach and count carries to completion | P0 | Built | SRC-MOB-019, SRC-MOB-001 |
| FR-MOB-025 | The training flow shall allow an optional inline follow-up task at completion | Follow-up task can be created or skipped | P1 | Built | SRC-MOB-019 |
| FR-MOB-026 | A training session shall be saveable as a training phone draft on CRM failure | Draft persists; retry submits complete session payload | P0 | Built | SRC-MOB-019, SRC-MOB-012 |

### 7.5 Route Plan And Visit Execution

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-MOB-027 | Pulse Mobile shall order nearby accounts by oldest last-touch as an interim stop list | Route screen shows accounts sorted by ascending `lastEngagementAt` | P0 | Built | SRC-MOB-008, SRC-MOB-001 |
| FR-MOB-028 | Pulse Mobile shall present colour-coded account pins on the map view filtered by account type (active, inactive, onboarding, members list, consignment overdue, prospect) and shall not change existing Map My Customer colour assignments | Map pins match agreed colour scheme; filter toggles available per type | P0 | Built — partial (MapLibre status-coloured markers ship in `app/(tabs)/map.tsx`; per-pin geocode precision is now surfaced and navigation is gated — state-centroid pins are blocked, city-level pins navigate with an approximate-location flag — commit e28aee1. Remaining gap: the final colour map vs ASM-MOB-08 and real street-level geocoding, both pending the geocoding-provider decision) | SRC-MOB-002, SRC-MOB-021 |
| FR-MOB-029 | Pulse Mobile shall allow the field user to filter the map/list view to show only specific account types | Filter/toggle dropdown available; supports multi-select | P1 | Built (multi-select account-type status filter implemented on the map in `app/(tabs)/map.tsx`) | SRC-MOB-002, SRC-MOB-021 |
| FR-MOB-030 | Pulse Mobile shall start a visit immediately on the phone and create/check-in through the CRM site-visit model | CRM receives check-in event; visit record created at tap | P0 | Built | SRC-MOB-008 |
| FR-MOB-031 | Pulse Mobile shall capture foreground GPS when location permission is granted; when permission is unavailable the visit shall be timed-only and shall not block | GPS latitude/longitude stored on visit; timed-only visit completes without GPS | P0 | Built (BR-M-05) | SRC-MOB-008, SRC-MOB-001 |
| FR-MOB-032 | Checkout shall require the user to enter notes before the visit can be completed; the app shall not allow a new check-in or route progress until checkout is complete | Submit is blocked until checkout notes are present | P0 | Built (CG/Don: "you can't leave without putting notes"; CG: "can't check out successfully and therefore can't check in anywhere else") | SRC-MOB-008, SRC-MOB-002 |
| FR-MOB-033 | A completed visit shall sync to CRM or be saved as a retryable route phone draft on failure; a completed-today review list shall be shown | Draft persists; completed visits appear in review list | P0 | Built | SRC-MOB-008, SRC-MOB-012 |
| FR-MOB-034 | Route navigation shall offer a choice of Google Maps, Apple Maps, or Waze for turn-by-turn handoff. In-app turn-by-turn is explicitly NOT built; navigation is delegated to the external app for the selected stop — the Map My Customer model Don and the BA confirmed in Session 4. | Navigation handoff button opens the chosen provider for the selected stop | P1 | Built (RTE-P1/P2, commit 459d069 — `external-nav.ts` formats Waze/Google/Apple deep links via free OS URL schemes with an https fallback, surfaced as a "Navigate" chooser on route stops + a map-marker long-press; remembers the last provider). In-app turn-by-turn stays out of scope (delegated to the external app) | SRC-MOB-002 |
| FR-MOB-035 | The account detail view shall show contacts associated with that account so the TM can call or email the right person directly | Account detail includes contacts list with call/email actions | P1 | Built (per-contact tap-to-call / tap-to-email wired on account detail via a unit-tested contact-link helper — commit fb7f5d8) | SRC-MOB-002, SRC-MOB-016 |
| FR-MOB-036 | The account detail view shall show a sales activity tab (current year-to-date, last year YTD) alongside consignment and history tabs; the consignment tab shall be greyed out / hidden for accounts not on consignment | Four-tab account detail: Overview / Sales / Consignment / History | P1 | Built — partial (four-tab account detail — Overview / Sales / Consignment / History — ships via a new SegmentedTabs primitive, with the Consignment tab greyed out when the account has no sites — commit d0bde8d. The Sales tab surfaces order drafts; YTD/last-year sales totals stay parked on the Acumatica feed) | SRC-MOB-002, SRC-MOB-016 |

### 7.6 Field Capture — Voice Note And Business Card

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-MOB-037 | Pulse Mobile shall capture a voice note (editable transcript text), scope it to general CRM or a specific account, and sync it for office review | Voice note with title and transcript syncs; context selection persists | P0 | Built | SRC-MOB-009, SRC-MOB-001, SRC-MOB-002 |
| FR-MOB-038 | Pulse Mobile shall support voice-to-text dictation for field notes so TMs can log activity while on site without typing | Voice recording captured and transcribed; transcript editable before submit | P0 | Built (transcript editing confirmed; live speech-to-text provider TBD) | SRC-MOB-001, SRC-MOB-002 |
| FR-MOB-039 | Pulse Mobile shall capture a business card via camera, gallery, or pasted text and preview extracted lead fields with per-field confidence scores and review reasons | OCR preview shows extracted fields + confidence; pasted text fallback works | P0 | Built (capture + preview) | SRC-MOB-010 |
| FR-MOB-040 | Business-card candidates shall be routed into the governed CRM lead review workflow, never silently creating a lead on the device | "Create lead" path submits through governed lead API; no silent device-side creation | P0 | Not-built — commit path (ocr-capture.tsx ships a working "Send to CRM review queue" share-handoff for preview-and-review; the governed device-side commit endpoint is not built — there is no disabled "Create lead" button, contrary to the earlier note — UX-M-008 / Q-M-01) | SRC-MOB-010 |
| FR-MOB-041 | Business-card capture shall enforce: images only, 4 MB size cap, and capped pasted text | Files >4 MB rejected with user-facing error; non-image files rejected | P0 | Built | SRC-MOB-010 |

### 7.7 Lead And Account Field Activity

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-MOB-042 | Mobile lead detail shall support call disposition logging (note + timestamp) on the spot | Call disposition panel on lead detail; log call submits to CRM | P0 | Built (UX-M-005) | SRC-MOB-015 |
| FR-MOB-043 | Mobile lead detail shall support mobile stage change (select stage + note) | Stage change panel on lead detail; advances through MOBILE_ADVANCEABLE_STAGES | P1 | Built (UX-M-005) | SRC-MOB-015 |
| FR-MOB-044 | Account detail shall support a lightweight account-visit log action (note → submit as voice note with route_visit context) | Visit log entry submits note to CRM; confirmation message shown | P0 | Built (UX-M-006) | SRC-MOB-016, SRC-MOB-002 |
| FR-MOB-045 | The account detail view shall show an "Open account" navigation link from any field activity review row | Tapping review row navigates to account detail screen | P0 | Not-built (UX-M-001 open) | SRC-MOB-002 |
| FR-MOB-046 | Mobile lead inbox shall show the full lead queue with search; the lead queue shall not be permanently buried | Lead inbox accessible within 2 taps from Today; search filters correctly | P0 | Built — partial (a 1-tap "Lead inbox" shortcut on Today makes the queue reachable without burying it — commit fb7f5d8; the Leads bottom-tab placement, Q-M-02, remains a product decision) | SRC-MOB-005 |
| FR-MOB-047 | Mobile shall support submitting an order on behalf of a customer from the account context: open the customer's account, tap "Submit Order", pick products from the catalog (e.g. "P-Max 1625"), confirm, and submit. The submit is the trigger that pushes the order to Acumatica (system of record for orders/numbers/finance); for a brand-new customer the same first-order submission also creates the Acumatica account and pushes the contact data. This is the field/TM channel of four order entry paths (dealer-portal self-service, staff email, TM-in-field, phone/in-person). | Order submission from account detail routes through the governed Pulse API and onward to Acumatica; first-order submission triggers Acumatica account creation; no double entry between CRM and Acumatica | P1 — CG twice called this "critical" (Session 10); a launch-blocker decision is pending (OQ-MOB-10) | CRM half SHIPPED (2026-06-19) — the buildable-now Pulse `OrderDraft` capture flow is live end-to-end: a TM opens the account, taps "New order", adds catalog/custom lines with quantities, picks ship-to, and Saves/Submits to back-office triage; the office then reviews submitted orders in a web triage queue (`/orders`) and marks them fulfilled (keyed into Acumatica) or cancelled (commits `0682328` backend + `4e4f649` mobile UI + `53e594c` web triage queue; see §BUILD). PARKED (gated on Acumatica access): live order placement, ERP account-create-on-first-order, and authoritative price/tax/shipping — submit hands a captured intent to the office, it does not post to Acumatica. Build plan: `docs/ORDER_ON_BEHALF_BUILD_NOW_VS_ACUMATICA_PARKED_PLAN_2026-06-16.md`. Polish shipped (2026-06-21, commit 4f54538): per-line notes on each order line, and offline-queue parity — a save/submit that fails offline is persisted on-device and replayed from Sync Status (live Acumatica placement remains parked as above) | SRC-MOB-002, SRC-MOB-004 |

### 7.8 Canonical Draft / Sync State And "My Work"

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-MOB-048 | The app shall collapse all legacy status vocabularies into one canonical 6-state model: Saved on phone / Sending / CRM saved / Needs retry / Sign in again / Needs review | All draft/sync copy matches canonical states; no legacy vocabulary in field-facing copy | P0 | Built (UX-M-002) | SRC-MOB-012, SRC-MOB-002 |
| FR-MOB-049 | A single Sync Status screen shall be the one "my work" inventory, showing each draft's contents (ROSE variance summary, route summary, training completion summary), with retry and discard controls | Sync Status screen lists all draft kinds with content preview; retry/discard functional | P0 | Built | SRC-MOB-011, SRC-MOB-012 |
| FR-MOB-050 | "CRM saved" shall be shown only after the API accepts the work; "Saved on phone" shall be shown only after durable native storage has accepted the draft | No premature CRM saved confirmation; storage hydration checked before drafts relied upon | P0 | Built (BR-M-07) | SRC-MOB-012 |

### 7.9 Offline And Reliability Behaviour

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-MOB-051 | Pulse Mobile shall persist route visits, ROSE drafts, and training completions locally and report "Saved on phone" only after durable native storage has accepted the draft | Draft saves only after storage confirm; app restart does not lose drafts | P0 | Built | SRC-MOB-012, SRC-MOB-001 |
| FR-MOB-052 | Offline drafts shall be metadata/text-only: no media bytes, base64, file URIs, or storage keys are stored on the device until an approved encrypted storage adapter exists | Code inspection confirms no binary content in draft payload | P0 | Built (BR-M-08) | SRC-MOB-012 |
| FR-MOB-053 | Draft queue shall cap payload and queue size; account/customer names in draft titles shall be redacted; stale drafts shall expire on defined windows | Route draft expiry and ROSE/training draft expiry enforced; titles truncated/redacted | P1 | Built (expiry policy in mobile-draft-route-policy.ts) | SRC-MOB-012 |
| FR-MOB-054 | Stuck "sending" drafts shall reset to "Saved on phone" after app reload; if local storage cannot be confirmed, fall back to in-memory drafts with a clear warning | Reload clears stuck syncing state; in-memory fallback warning visible | P0 | Built | SRC-MOB-012 |

### 7.10 Authentication, API, And Security

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-MOB-055 | The API base URL shall be restricted to an approved host allowlist over HTTPS; localhost shall be permitted for QA only | URL validation rejects unapproved hosts; HTTP rejected except localhost | P0 | Built (BR-M-10) | SRC-MOB-014 |
| FR-MOB-056 | Authentication shall use the same credentials as Pulse web (shared identity provider); a host-switchable API base URL shall support QA environments | Login screen accepts Pulse credentials; API base URL switchable in settings | P0 | Built | SRC-MOB-014, SRC-MOB-001 |
| FR-MOB-057 | Every field action shall be written through the same governed Pulse API contracts used by the web platform; mobile shall not invent parallel data paths | All CRM writes use shared `@pulse/contracts`; no mobile-only data models | P0 | Built (BR-M-02) | SRC-MOB-001 |

### 7.11 Regional Director Mobile Views

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-MOB-058 | Regional Directors shall be able to access high-level dashboards on mobile to monitor pipeline health, training compliance, and consignment exceptions | RD role sees regional rollup metrics in Today/dashboards; TM cannot see other TMs' data | P1 | Built (a role-gated "Director overview" — `app/rd-dashboard.tsx`, reachable from More for RD/exec/admin — rolls up pipeline, training, and cross-module exceptions from the RD-scoped reporting endpoints; revenue KPIs stay parked on the Acumatica feed — commit 76e2921) | SRC-MOB-002 |

### 7.12 Field-Capture And Calling Requirements Added From The 2026-06-14 Scope Audit

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-MOB-059 | Pulse Mobile shall make voice-to-text input available in the lead-capture / lead-create flow (not only in standalone Voice Notes), so a field user can dictate into lead fields | Voice-to-text input available on the lead capture/create surface; transcript editable before save | P1 | Built (lead detail has a 'Voice note' action deep-linking to the capture pre-scoped to that lead via `parseVoiceNotePresetContext`; reuses the Voice Notes recorder/transcript) | SRC-MOB-001, SRC-MOB-004 (Michelle: "voice text option could be available in the lead area as well … everywhere") |
| FR-MOB-060 | Pulse Mobile shall support tap-to-call a lead/account contact from within the app, with optional per-call auto-logging of the call as a disposition — ⚠️ CORRECTED 2026-06-18: CG only (not Don); auto-log-as-disposition is design-inferred (see Scope corrections). | Tap-to-call initiates a device call; user can opt to auto-log the call (note + timestamp) to CRM | P1 | Built (lead detail Call opens the dialer and offers an optional 'Log call placed' disposition via the existing log-initial-contact path, gated by `shouldOfferCallLog`) | SRC-MOB-002 (CG, Session 10 — device click-to-call, distinct from the parked desk/VoIP calling) |

### 7.13 Route-Builder Requirement Added From The 2026-06-16 Meeting-Research Pass

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-MOB-061 | Pulse Mobile shall provide a Map-My-Customer-parity route builder: the user selects multiple stops from the colour-coded map, sets a per-stop dwell time (1–60 min), and the system computes an optimized start→finish order with an end-of-day ETA, supporting multiple/saved routes; colour-coding is preserved on the route-building screen and turn-by-turn is handed off externally (FR-MOB-034). | Multi-select stops → optimized ordered route with per-stop dwell + ETA; routes can be saved; pins keep their colour through route building | P1 | Built (buildable-now slices RTE-P1–P7): multi-select route builder with add/remove/reorder, Optimize via client nearest-neighbour that consumes the existing server route plan (459d069, f843a46), per-stop dwell + straight-line end-of-day ETA (b41f062), saved/named routes (local-first, 6b00087), a map→route bridge (add stops from the map via marker long-press; selection shared across tabs, 2bde46c), and colour-coding preserved through routing (a3b85e1). PARKED behind the maps-provider decision (OQ-MOB-08): real road-distance/traffic-aware ETA + a true distance-optimized TSP (RTE-K2), and server-side route sync / manager share-export (RTE-K4). Build plan: `docs/ROUTE_OPTIMIZATION_BUILD_NOW_VS_PARKED_PLAN_2026-06-16.md` | SRC-MOB-002 (Don, Session 4: 1–60 min dwell, "at your hotel by seven o'clock", multiple routes) |

---

## 8. Non-Functional Requirements

| ID | Requirement | Category | SRC |
|---|---|---|---|
| NFR-MOB-001 | The Today home shall load and render the first visible section within 3 seconds on an LTE connection | Performance | SRC-MOB-001 (inferred from field-first design) |
| NFR-MOB-002 | Section-level load degrades independently: a single failing API endpoint shall not blank the entire Today screen | Availability / Resilience | SRC-MOB-006 |
| NFR-MOB-003 | The API base URL shall only be changed by an authorised user with QA environment knowledge; the UI shall validate and reject unapproved hosts at entry time | Security | SRC-MOB-014 |
| NFR-MOB-004 | All Pulse API calls from mobile shall use HTTPS; HTTP is blocked except for localhost QA addresses | Security | SRC-MOB-014 |
| NFR-MOB-005 | Offline drafts shall not contain any media bytes, base64 content, file URIs, or storage keys until an approved encrypted storage adapter is provisioned | Security / Data at rest | SRC-MOB-012 |
| NFR-MOB-006 | Account/customer names in local draft titles shall be redacted to the minimum needed for the user to identify the draft | Data privacy | SRC-MOB-012 (inferred standard) |
| NFR-MOB-007 | Stale drafts shall expire on defined age windows (route drafts age out faster than ROSE/training drafts) | Data hygiene / Storage | SRC-MOB-012 |
| NFR-MOB-008 | The app shall be built in React Native / Expo and share `@pulse/contracts` TypeScript types with the web platform to prevent API drift | Maintainability / Type safety | SRC-MOB-001 (inferred from shared contracts architecture) |
| NFR-MOB-009 | Mobile field roles shall see only the data their territory/assignment scopes allow; TMs see their assigned accounts/sites only; RDs see their regional rollup | Authorization | SRC-MOB-002 (CG/Don: "they don't need to see everybody's") |
| NFR-MOB-010 | ROSE audit evidence files shall be capped at 4 MB per file and a maximum of 3 files per audit | Scalability / Storage | SRC-MOB-007 |
| NFR-MOB-011 | The app shall confirm durable native storage is hydrated before surfacing "Saved on phone" confirmation; the app shall fall back to in-memory drafts with a visible warning if storage is unavailable | Reliability / Data durability | SRC-MOB-012 |
| NFR-MOB-012 | All field activity writes (visit logs, ROSE submissions, training completions, voice notes) shall produce an audit trail in CRM with user identity, timestamp, and source | Auditability | SRC-MOB-001, SRC-MOB-002 (inferred standard) |
| NFR-MOB-013 | The app shall support iOS and Android; tablet (iPad) form-factor support shall be confirmed by Dynamic AQS | Platform coverage | SRC-MOB-002 (CG: "will the app work on mobile phones and iPads?"; Ahmad: "yeah") |
| NFR-MOB-014 | The canonical draft vocabulary shall use plain-English field-facing labels (Saved on phone / Sending / CRM saved / Needs retry / Sign in again / Needs review); no legacy technical strings ("local_only", "CRM pending", "Will retry") shall appear in user-facing copy | Accessibility / Usability | SRC-MOB-012 |
| NFR-MOB-015 | The live-CRM-data status panel vocabulary shall match the canonical draft vocabulary so the field user learns one language | Consistency / Usability | SRC-MOB-006 |
| NFR-MOB-016 | Pulse Mobile shall provide an outdoor-readable theme (dark mode and/or high-contrast) suitable for sunlight field use; for a field app this is treated as functional, not cosmetic | Usability / Field readability | SRC-MOB-020 (app is `userInterfaceStyle: light` only today) |
| NFR-MOB-017 | Interactive controls shall carry accessibility labels and the app shall honour Dynamic Type / OS font scaling, targeting WCAG AA | Accessibility | SRC-MOB-020 (only the notification bell has an `accessibilityLabel` today; type sizes are fixed px) |

---

## 9. Business Rules Pulse Will Enforce

| # | Rule | SRC |
|---|---|---|
| BR-M-01 | The mobile app is a field-execution companion to Pulse CRM; back-office work (CIS, finance, account setup, Acumatica warehouse creation, reporting administration) is web-first and out of mobile scope. | SRC-MOB-001, SRC-MOB-002 |
| BR-M-02 | Every field action will be written through the same governed Pulse API contracts and rules used by the web platform; mobile will not invent parallel data paths. | SRC-MOB-001 |
| BR-M-03 | A ROSE audit will not be submittable until all line counts, the audit note, attestation name, and attestation confirmation are present, and a variance will require at least one discrepancy photo. | SRC-MOB-002, SRC-MOB-007 |
| BR-M-04 | A ROSE variance will submit as an open reconciliation so PO/discrepancy follow-up remains visible; a balanced count will submit as a confirmed true-up. | SRC-MOB-002, SRC-MOB-007 |
| BR-M-05 | A route visit will require checkout notes before completion; the user cannot check in elsewhere until the current visit is checked out. | SRC-MOB-002 (CG: "can't check out without notes"; Don: "I like that a lot") |
| BR-M-06 | Business-card capture will be preview-first; a lead will only be created through the governed CRM review/routing flow, never silently on the device. | SRC-MOB-010 |
| BR-M-07 | Field work will never be silently lost: when CRM is unreachable, work is preserved as a phone draft and "CRM saved" is shown only after the API accepts it. | SRC-MOB-012 |
| BR-M-08 | Offline drafts will be metadata/text-only; no media bytes, base64, file URIs, or storage keys will be stored on the device until an approved encrypted storage adapter exists. | SRC-MOB-012 |
| BR-M-09 | One canonical draft/sync vocabulary will be used everywhere in the app; the three legacy status vocabularies are not permitted in field-facing copy. | SRC-MOB-012 |
| BR-M-10 | The API base URL will be restricted to approved Pulse hosts over HTTPS (localhost permitted for QA only). | SRC-MOB-014 |
| BR-M-11 | Parked dependencies (Acumatica truth, SKU scanning, push, background sync, offline media, route optimization) will not be presented as complete in the app or in progress reporting. | SRC-MOB-002 |

---

## 10. Data And Integration Highlights

At business level, this module will depend on and feed the following:

| Area | Proposed Pulse Mobile Role |
|---|---|
| Leads | Mobile reads the lead queue/detail and feeds card-capture candidates and field lead activity into the governed lead workflow |
| Accounts | Mobile reads account context and feeds visit/touch activity; account detail shows embedded training context |
| Territory | Mobile uses territory truth for which sites, accounts, and queues a field user sees |
| Consignment | Mobile reads due ROSE sites and submits counts, notes, attestation, and evidence; CRM owns discrepancy and PO follow-up |
| Training | Mobile executes formal sessions (check-in / proof / complete) and route visits through the shared `site_visit` model |
| Digital Assets | Mobile searches approved assets and creates customer-safe share links |
| Sync / Drafts | Mobile owns the phone-saved draft inventory and retries into CRM; CRM owns conflict policy (parked) |
| Acumatica | Mobile displays expected-count source/freshness only; inventory truth, PO posting, and reconciliation stay back-office (parked) |

---

## 11. Assumptions

| ID | Assumption | Why It Matters | SRC |
|---|---|---|---|
| ASM-MOB-01 | The primary mobile persona is the Territory Manager (field-first, often driving, glanceable UI), with Regional Directors as a secondary field user | This drives information architecture, default surfaces, and the ranking of "Start here" | SRC-MOB-001, SRC-MOB-002 |
| ASM-MOB-02 | "Today" home is the correct default landing surface, not a map or calendar | The old master PRD assumed a map/calendar-centric app; the build is Today-centric and this PRD specs the built model | SRC-MOB-006 |
| ASM-MOB-03 | ROSE is the only consignment audit type the field needs on mobile; BLUE/PURPLE/SAND remain web/back-office | This bounds consignment mobile scope and field training | SRC-MOB-002 (Samantha: recurring reconciliation optional; only BLUE signature mandatory) |
| ASM-MOB-04 | Route stop ordering by oldest last-touch is acceptable as an interim until geographic optimization is approved. The target (Map My Customer parity, per Don, Session 4) is a multi-stop route builder: select several stops (training, prospects, lunch/dinner), set per-stop dwell time (1–60 min), the system optimizes start→finish and predicts end-of-day arrival ("you're gonna be at your hotel by seven o'clock"), and supports multiple/saved routes — with colour-coding preserved on the route-building screen (Don's explicit MMC pain point) and turn-by-turn delegated to an external app. | This sets field expectations before a maps provider decision | SRC-MOB-008, SRC-MOB-002 |
| ASM-MOB-05 | Voice notes and card capture are office-review inputs; automatic writeback into records is a later, separately approved behaviour | This bounds the AI/structuring scope and avoids unreviewed data entering records | SRC-MOB-009, SRC-MOB-010 |
| ASM-MOB-06 | Offline drafts being metadata-only (no photo bytes) is acceptable for launch, with photos uploading only when CRM is reachable | This affects how a TM works a site with no signal and when evidence is guaranteed to arrive | SRC-MOB-012 |
| ASM-MOB-07 | Authentication uses the same credentials as Pulse web, with a host-restricted, switchable API base URL for QA | This affects login UX, environment safety, and field support | SRC-MOB-014 |
| ASM-MOB-08 | Existing Map My Customer colour-coding for account pins shall be preserved UNCHANGED, then the consignment piece added as a NEW distinct colour. CG (Session 10), verbatim: "I don't want to change colors. If guys have been using Map My Customer for a couple years now, I don't want the color code to change and have them get messed up. So I want to maintain a similar color coding and then add to it, the consignment piece with maybe a different color." The legend Don gave (Session 10): dark green = sold account, light green = active lead, [inactive-lead colour — transcript token garbled as "AD"; CONFIRM with client], blue = members list, purple = onboarding (US). The authoritative colour→meaning list (incl. the consignment / consignment-overdue colours) is a Currie-side deliverable — CG: "our team will create a list … for what we need color coded within the app." | Prevents re-training confusion for TMs who have used Map My Customer for years | SRC-MOB-002 (CG, Session 10) |
| ASM-MOB-09 | The app shall run on both smartphone and tablet (iPad) — confirmed by CG in Session 10 | TMs and RDs may use iPads in the field | SRC-MOB-002 |
| ASM-MOB-10 | A TM who is checked in to a visit cannot check in to a different account until they have completed (checked out and entered notes for) the current visit | Enforcement is at app level; confirmed as desired behaviour by CG and Don in Session 10 | SRC-MOB-002 |

---

## 12. Open Questions

| ID | Question | Options To Confirm | Why Decision Is Needed |
|---|---|---|---|
| OQ-MOB-01 | What is the approved mobile path for committing a captured business card into a lead? | review queue in CRM web / mobile-side review commit / desk re-entry | Card capture currently dead-ends on a disabled button (UX-M-008); the commit contract must be confirmed |
| OQ-MOB-02 | Where should the lead inbox live in the navigation contract? | first-class bottom tab / surfaced via Today + bell / launcher item | The lead queue is core daily work and must not be buried as it is today |
| OQ-MOB-03 | What mobile lead activity should a field user be able to log on the spot? | call disposition only / disposition + next step / disposition + next step + stage change | Lead detail has call disposition and stage change (UX-M-005); confirm whether next-step capture is also required |
| OQ-MOB-04 | Does the field user need additional calendar depth (week-view, six-weeks-ahead scheduling) beyond what is built? | week-view / deeper scheduling / current month-grid + day-agenda is sufficient | Don requested month-view in Session 10 for scheduling six weeks ahead. Both the Today day-agenda strip AND a full month-matrix grid with month navigation are now built (`app/(tabs)/calendar.tsx`, SRC-MOB-022); the remaining decision is only whether week-view or deeper scheduling depth is also required |
| OQ-MOB-05 | What is the canonical draft/sync vocabulary to adopt platform-wide? | the proposed 6-state set in Section 7.8 / an amended set / align to a web-side term set | Three inconsistent vocabularies exist today and must converge |
| OQ-MOB-06 | What push provider and notification governance should mobile use? | Expo Push / FCM+APNs / deferred until a later gate | Determines whether field alerts are real-time and which infrastructure dependency is taken |
| OQ-MOB-07 | When are offline photo bytes and background sync needed for launch? | required at launch / fast-follow / later phase | Both are parked today; confirming priority sets the storage/security and background-work roadmap |
| OQ-MOB-08 | Which navigation provider should be the default for route handoff — Google Maps, Apple Maps, or Waze? | Google Maps default / Apple Maps default / Waze default / user-selectable | Don confirmed TMs prefer different providers; Ahmad confirmed three options are planned; not yet built |
| OQ-MOB-09 | Should the consignment pin colour on the territory map be a new colour distinct from the existing Map My Customer set, and if so, which colour? | new colour assigned by Dynamic AQS | CG: "add to it the consignment piece with maybe a different colour" |
| OQ-MOB-10 | Is an in-app order submission screen (on behalf of a customer) required at launch, and which API governs it? | required at launch / post-launch / defer to dealer portal | Don confirmed the need in Session 10; no order submission screen exists in the current build |

---

## 13. Later-Phase / Separate Decision Items

These items may still belong in the broader Pulse mobile roadmap, but will not be assumed as finalised by this PRD:

- Acumatica live inventory/SKU truth on mobile and barcode/SKU scanning
- offline photo/media byte storage with an encrypted, file-backed adapter
- push notifications, deep links, and background upload/sync workers
- route geographic optimization, geofenced auto check-in, and navigation handoff (confirmed desired by Don/CG; parked pending provider decision)
- automatic AI writeback from voice notes/card capture, with an office approval UI
- offline conflict-merge rules and server-side conflict resolution
- mobile commerce/checkout (hand off to Dealer Portal rather than becoming the dealer checkout app)
- Android emulator/device QA hardening and French-language support for Canada
- Outlook 365 calendar bi-directional sync (Microsoft Graph dependency; discussed in Sessions 1 and 10 as desirable)
- Daily order notification digest for TMs — Don asked "is there any way that the guys could get notification on orders placed"; CG is leaning to a once-a-day digest ("here's what your orders for the day"), explicitly NOT a per-order email (a per-order Acumatica alert once buried Brett under 30 emails). Acumatica-side; a field concern, not a mobile build item.
- Store/customer recognition photos (storefront, owner, customer trucks) attached to an account for in-person recognition (Michelle/Don, Session 10) — distinct from ROSE/training/OCR images
- Name-tag / show-badge photo capture for lead creation (OCR beyond business cards) at trade shows (CG)
- Map / location visibility surfaced inside the web CRM for office/BD personas (not only the mobile app) — likely belongs to a web PRD; cross-referenced here for completeness
- In-app SMS / marketing messaging capability (raised as an open question by the client; governance + provider undecided)
- Optimistic-UI / non-blocking submit on check-in and ROSE submit for slow networks (SRC-MOB-020)
- Thumb-zone ergonomics for one-handed in-car use — bottom-sheet forms + FAB (SRC-MOB-020; refines ASM-MOB-01)
- Field-facing offline conflict-resolution UI (merge / keep-mine / keep-server / discard) layered on the parked conflict-merge policy (SRC-MOB-020)
- Empty / loading / error skeleton-state polish across field surfaces (SRC-MOB-020)

---

## 14. Requirement-to-Source Traceability Matrix

| Requirement ID | SRC ID(s) | Session |
|---|---|---|
| FR-MOB-001 | SRC-MOB-001, SRC-MOB-006 | Session 1 (Feb 16), built code |
| FR-MOB-002 | SRC-MOB-001, SRC-MOB-006, SRC-MOB-013 | Session 1, built code |
| FR-MOB-003 | SRC-MOB-001, SRC-MOB-006 | Session 1, built code |
| FR-MOB-004 | SRC-MOB-001, SRC-MOB-006 | Session 1, built code |
| FR-MOB-005 | SRC-MOB-006, SRC-MOB-017 | Built code (UX-M-007) |
| FR-MOB-006 | SRC-MOB-001, SRC-MOB-006 | Session 1 (calendar), built code (UX-M-004) |
| FR-MOB-007 | SRC-MOB-005, SRC-MOB-018 | Built code |
| FR-MOB-008 | SRC-MOB-005, SRC-MOB-006 | Built code |
| FR-MOB-009 | SRC-MOB-002 | Session 10 (Mar 17) |
| FR-MOB-010 | SRC-MOB-007, SRC-MOB-002 | Session 10, built code |
| FR-MOB-011 | SRC-MOB-007, SRC-MOB-002 | Session 10, built code (UX-M-003 open) |
| FR-MOB-012 | SRC-MOB-007 | Built code |
| FR-MOB-013 | SRC-MOB-007, SRC-MOB-002 | Session 10, built code |
| FR-MOB-014 | SRC-MOB-007 | Built code (BR-M-03) |
| FR-MOB-015 | SRC-MOB-007 | Built code |
| FR-MOB-016 | SRC-MOB-007, SRC-MOB-002 | Session 10, built code |
| FR-MOB-017 | SRC-MOB-007 | Built code (BR-M-04) |
| FR-MOB-018 | SRC-MOB-007, SRC-MOB-012 | Built code |
| FR-MOB-019 | SRC-MOB-001, SRC-MOB-002 | Sessions 1, 10 — Parked |
| FR-MOB-020 | SRC-MOB-002 | Session 10 (Samantha, CG) |
| FR-MOB-021 | SRC-MOB-019, SRC-MOB-001 | Session 1, built code |
| FR-MOB-022 | SRC-MOB-019 | Built code |
| FR-MOB-023 | SRC-MOB-019, SRC-MOB-001 | Session 1, built code |
| FR-MOB-024 | SRC-MOB-019, SRC-MOB-001 | Session 1, built code |
| FR-MOB-025 | SRC-MOB-019 | Built code |
| FR-MOB-026 | SRC-MOB-019, SRC-MOB-012 | Built code |
| FR-MOB-027 | SRC-MOB-008, SRC-MOB-001 | Session 1, built code |
| FR-MOB-028 | SRC-MOB-002 | Session 10 (CG, Don — colour-coded pins) |
| FR-MOB-029 | SRC-MOB-002 | Session 10 (Don — filter dropdown) |
| FR-MOB-030 | SRC-MOB-008 | Built code |
| FR-MOB-031 | SRC-MOB-008, SRC-MOB-001 | Session 1, built code |
| FR-MOB-032 | SRC-MOB-008, SRC-MOB-002 | Session 10 (CG, Don), built code |
| FR-MOB-033 | SRC-MOB-008, SRC-MOB-012 | Built code |
| FR-MOB-034 | SRC-MOB-002 | Session 10 (Ahmad demo, Don/CG) |
| FR-MOB-035 | SRC-MOB-002, SRC-MOB-016 | Session 10 (CG), partial build |
| FR-MOB-036 | SRC-MOB-002, SRC-MOB-016 | Session 10 (Don, CG — sales tab), partial build |
| FR-MOB-037 | SRC-MOB-009, SRC-MOB-001, SRC-MOB-002 | Sessions 1, 10, built code |
| FR-MOB-038 | SRC-MOB-001, SRC-MOB-002 | Sessions 1 ("voice-to-text entry"), 10 ("voice-to-text activity logging") |
| FR-MOB-039 | SRC-MOB-010 | Built code |
| FR-MOB-040 | SRC-MOB-010 | Built code (UX-M-008 open) |
| FR-MOB-041 | SRC-MOB-010 | Built code |
| FR-MOB-042 | SRC-MOB-015 | Built code (UX-M-005) |
| FR-MOB-043 | SRC-MOB-015 | Built code (UX-M-005) |
| FR-MOB-044 | SRC-MOB-016, SRC-MOB-002 | Session 10, built code (UX-M-006) |
| FR-MOB-045 | SRC-MOB-002 | Built code (UX-M-001 open) |
| FR-MOB-046 | SRC-MOB-005 | Built code (Q-M-02 unresolved) |
| FR-MOB-047 | SRC-MOB-002 | Session 10 (Don, CG) |
| FR-MOB-048 | SRC-MOB-012, SRC-MOB-002 | Built code (UX-M-002) |
| FR-MOB-049 | SRC-MOB-011, SRC-MOB-012 | Built code |
| FR-MOB-050 | SRC-MOB-012 | Built code (BR-M-07) |
| FR-MOB-051 | SRC-MOB-012, SRC-MOB-001 | Session 1 ("offline capability"), built code |
| FR-MOB-052 | SRC-MOB-012 | Built code (BR-M-08) |
| FR-MOB-053 | SRC-MOB-012 | Built code |
| FR-MOB-054 | SRC-MOB-012 | Built code |
| FR-MOB-055 | SRC-MOB-014 | Built code (BR-M-10) |
| FR-MOB-056 | SRC-MOB-014, SRC-MOB-001 | Session 1, built code |
| FR-MOB-057 | SRC-MOB-001 | Built code (BR-M-02) |
| FR-MOB-058 | SRC-MOB-002 | Session 10 (Ahmad, CG — RD dashboards) |
| NFR-MOB-001–015 | SRC-MOB-001 through SRC-MOB-019 | Various sessions and built code (see NFR table) |
| ASM-MOB-01–10 | SRC-MOB-001, SRC-MOB-002, SRC-MOB-006 | Sessions 1, 10 |
| OQ-MOB-01–10 | SRC-MOB-002, SRC-MOB-010 | Sessions 1, 10 |

---

## 15. Approval Checklist

Dynamic AQS approval of this PRD will confirm:

- the mobile app is correctly framed as a field-execution companion to Pulse CRM, not a standalone product
- the "Today"-home, tab-based model reflects how field users actually work (versus the old map/calendar-centric assumption)
- the ROSE audit, training execution, route visit, and capture flows match field reality
- the navigation contract fix (un-burying core queues) and the gap-closure requirements are the right priorities
- the single canonical draft/sync model is the correct direction
- the parked dependencies are agreed as separate decisions
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
All items with **Can do now = Yes** have no external dependency.

### Sprint 1 — Quick Wins (S effort)
| ID | Requirement | Component | Can do now? | Status |
|----|-------------|-----------|-------------|--------|
| UX-M-001 | FieldActivityReview items have no "Open account" link from review row | FieldActivityReview.tsx | Yes | Open |
| UX-M-002 | Three inconsistent draft/sync status vocabularies — need canonical 6-state vocabulary | Mobile app | Yes | Open |
| UX-M-003 | Stale Acumatica data warning missing on ROSE audit expected-count screen | Mobile app | Yes | Done (parked-vs-stale-vs-fresh source classification ships in consignment.tsx — FR-MOB-011, commit fb7f5d8) |

### Sprint 2 — Core Workflow (M effort)
| ID | Requirement | Component | Can do now? | Status |
|----|-------------|-----------|-------------|--------|
| UX-M-004 | No day-agenda/calendar strip on mobile Today home | Mobile app | Yes | Done |
| UX-M-005 | Mobile lead detail is read-only — no call disposition or stage change | Mobile app | Yes | Done |
| UX-M-006 | No lightweight account-visit log action on mobile account detail | Mobile app | Yes | Done |
| UX-M-007 | In-app overdue ROSE audit and SLA breach badge in Today home metric strip (no push provider needed) | Mobile app | Yes | Done |

### Sprint 3 — New Surfaces (L effort)
| ID | Requirement | Component | Can do now? | Status |
|----|-------------|-----------|-------------|--------|
| UX-M-008 | Business-card OCR commit path — create lead from mobile via web-side intake pre-fill (Q-M-01) | Mobile app | Yes | Open (parked: the "create lead" commit endpoint POST /api/v1/leads belongs to the leads backend module owned by another agent; mobile share/preview path is already complete in ocr-capture.tsx; full commit path requires a new leads-module endpoint or a governed Q-M-01 decision from Dynamic AQS) |

_To be completed during the review meeting._

---

## §UX-GAPS — Audit 2026-06-14 (Build-Status Reconciliation + Newly-Captured Scope)

A scope-coverage audit on 2026-06-14 cross-checked this PRD against the source meetings, the supporting field-UX gap analysis (SRC-MOB-020), and the as-built mobile code (16 findings confirmed, 1 refuted). The corrections and additions are folded into the sections above; this log records them.

**Build-status corrections (PRD previously understated delivered scope):**
- **FR-MOB-028 / FR-MOB-029** — the colour-coded, filterable MapLibre map IS built (`app/(tabs)/map.tsx`, SRC-MOB-021); only precise marker geo is stubbed. Was "Not-built".
- **OQ-MOB-04** — a full month-matrix calendar grid IS built (`app/(tabs)/calendar.tsx`, SRC-MOB-022); only week-view depth remains a question. Was "month/week not yet built".
- **FR-MOB-009 / NFR-MOB-013 / ASM-MOB-09** — iPad reconciled to a single status: runs on iPad (`supportsTablet: true`), responsive layout not yet optimized. Previously stated three different ways.
- **FR-MOB-035** — account contacts are now shown read-only; the Session-10 "not yet populated" note is obsolete.
- **FR-MOB-040** — OCR ships a working "Send to CRM review queue" share-handoff; there is no disabled "Create lead" button. Governed commit endpoint still not built (Q-M-01).
- **FR-MOB-011** — an Acumatica availability notice is surfaced; explicit stale/parked-source labeling still to confirm.

**Newly-captured scope (client-requested or field-functional, previously absent from every section):**
- **FR-MOB-059** — voice-to-text in lead capture ("everywhere", Michelle).
- **FR-MOB-060** — tap-to-call with optional per-call auto-log (CG/Don).
- **NFR-MOB-016** — dark / high-contrast outdoor theme.
- **NFR-MOB-017** — accessibility labels + Dynamic Type (WCAG AA).
- **Section 13 later-phase** — store/customer recognition photos, name-tag/badge OCR, web-CRM map for office/BD personas, in-app SMS, optimistic submit, thumb-zone ergonomics, offline conflict-resolution UI, skeleton states.

**Raised but refuted (not added):**
- List virtualization for large lists — flagged as a P0 gap, but on verification its supporting evidence was inaccurate, so it is not added here pending a fresh confirmation.

**Build update (2026-06-16):** all four P1 gaps above are now IMPLEMENTED (mobile typecheck + unit suite green): FR-MOB-060 click-to-call auto-log and FR-MOB-059 voice-in-lead-capture (commit d1fd933), NFR-MOB-017 accessibility labels + Dynamic Type (294c3b8), and NFR-MOB-016 dark + high-contrast theme — built as both OS-automatic dark and an opt-in high-contrast toggle (02f8a23). On-device visual QA of the dark/high-contrast palettes remains hardware-gated. The Section 13 later-phase items remain deferred.

### §UX-GAPS — Meeting-Research Depth Pass 2026-06-16

A transcript deep-read (Sessions 1/4/5/10/13-20) enriched three requirements that were PRESENT but UNDER-DETAILED:
- **In-app ordering (FR-MOB-047, OQ-MOB-10):** added CG's "critical" emphasis, the exact Submit-Order flow, and the Acumatica-trigger / first-order-creates-account rule.
- **Route optimization (ASM-MOB-04, FR-MOB-034, new FR-MOB-061):** added Don's full Map-My-Customer route-builder behaviour — multi-stop, 1–60 min dwell, end-of-day ETA, saved/multiple routes, colour preserved through routing.
- **Map colour-coding (ASM-MOB-08, OQ-MOB-09):** added CG's verbatim "don't change colors", the colour legend, the ambiguous inactive token, and the pending Currie-side authoritative colour-list deliverable.

**Why these were under-captured (root cause, not blame):** v2.0 was built **as-built-code-first** plus a **summary-level** meeting-traceability pass — so *built* features got rich detail while **parked/unbuilt** features (ordering, route optimization) were recorded at headline level and the deeper verbatim (dwell times, ETA, "critical", the colour-list deliverable) stayed in the transcripts. The 2026-06-14 scope-coverage audit then cross-checked the PRD against sources for **presence**, and because these requirements **were present** (as FR/ASM/OQ rows), they registered as *captured*, not *missing* — so depth was never re-examined. Fix going forward: for any parked/unbuilt requirement, do a per-requirement transcript deep-read (not just a presence check) before sign-off.

### §BUILD — Route optimization & map colour-coding delivery (2026-06-16)

The buildable-now Map My Customer route capability is SHIPPED (mobile typecheck + unit suite green; each slice passed an adversarial multi-lens review). All slices are provider-free — no Google/Mapbox, no API key, no billing — riding the haversine/route data already in the app and free OS nav URL schemes.

- **Map colour-coding (ASM-MOB-08, OQ-MOB-09)** — commit `a3b85e1`. Existing Map My Customer pin colours preserved; added `consignment` / `consignment_overdue` statuses (placeholder amber/red, clearly TODO pending Currie's authoritative colour list); colour carried through the route builder. Required a root-cause server fix (the account-list read model was mislabelling every consignment account "onboarding").
- **External nav handoff (FR-MOB-034)** — commit `459d069`. Waze/Google/Apple deep links + https fallback, "Navigate" chooser on stops + map markers, remembers last provider.
- **Route builder + Optimize (FR-MOB-061, RTE-P3/P4)** — commit `f843a46`. Multi-select add/remove/reorder, running straight-line miles, client nearest-neighbour Optimize, and Load-suggested consuming the server's route plan.
- **Per-stop dwell + end-of-day ETA (FR-MOB-061, RTE-P5)** — commit `b41f062`. Adjustable start time, tap-to-cycle dwell (1–60 min), circuity-adjusted straight-line ETA, all labelled "(est.)".
- **Saved/named routes (FR-MOB-061, RTE-P6)** — commit `6b00087`. Local-first save/load/duplicate/delete via SecureStore.
- **Map→route bridge (FR-MOB-061, RTE-P7)** — commit `2bde46c`. Long-press a map marker to Open / Add-or-Remove from route / Navigate; the route selection is shared across the Map and Route tabs (in-route markers highlighted, "N on route" count, assistive-tech route/navigate actions).

**Parked (OQ-MOB-08 / RTE-K-series):** real road-distance + traffic-aware ETA and a true distance-optimized TSP (needs the maps-provider + billing decision); street-level geocoding; server-side route persistence + manager share/export. Currie's authoritative colour list + the consignment-overdue definition (OQ-MOB-09) are one-file swaps when they land. The full split is in `docs/ROUTE_OPTIMIZATION_BUILD_NOW_VS_PARKED_PLAN_2026-06-16.md` and `docs/ORDER_ON_BEHALF_BUILD_NOW_VS_ACUMATICA_PARKED_PLAN_2026-06-16.md`.

### §BUILD — Order on behalf / `OrderDraft` delivery (2026-06-19, FR-MOB-047)

The buildable-now CRM half of order-on-behalf is SHIPPED. It is a Pulse-owned **order intent**, NOT an Acumatica order: submit hands the draft to back-office triage; authoritative pricing, tax, and ERP placement stay parked behind Acumatica access. Pricing is intentionally NOT entered in the field UI (it is Acumatica's truth — `BaseProduct` carries no price). Verified: 9 API regression cases (incl. catalog search + RBAC + lifecycle/scoping) + RBAC suite; mobile typecheck clean; 123 mobile unit tests (10 new for the order form). Each layer passed an adversarial multi-lens review.

- **Backend — `OrderDraft` model + governed API (ORD-P1–P3)** — commit `0682328`. `OrderDraft` + `OrderDraftLine` (status DRAFT→SUBMITTED→FULFILLED|CANCELLED, integer-cents money, migration `20260618170704_add_order_drafts`); `@pulse/contracts/orders`; the `apps/api/src/modules/orders` module with a new `orders` workspace module + `order.view`/`order.create`/`order.submit` actions, TM/RD record-scoping (reuses account scope), atomic lifecycle transitions, and full audit.
- **Mobile — capture UI (ORD-P4)** — commit `4e4f649`. "Order drafts" section + "New order" entry point on the account screen (refreshes on focus); a capture screen (`app/order-draft.tsx`) with catalog + custom lines, quantity steppers, ship-to picker, customer PO + office notes, Save-draft / Submit, and a read-only + Cancel view for already-submitted orders; a debounced catalog-search sheet backed by a self-contained `GET /api/v1/order-products` endpoint (under the `orders` module, gated `order.create`, so a TM can search products without the full product-management workspace).
- **Web — back-office triage queue (ORD-P6)** — commit `53e594c`. The office hand-off: a status-filtered queue at `/orders` (crm-web, gated to the `orders` module + `order.view`) where staff review a submitted order (account, lines, notes, ship-to) and Mark fulfilled (keyed into Acumatica) or Cancel with a reason. Closes the field→office loop for FR-MOB-047 without any Acumatica dependency.
- **First-order conversion signal (ORD-P5)** — commit `9363cab`. Behind a default-OFF flag (`ORDERS_FIRST_ORDER_AUTO_SIGNAL_ENABLED`), lead conversion derives the first-order timestamp (the conversion moment) instead of requiring a hand-keyed date — removing the `readiness.ts` stub as a reversible CRM intent. (The literal "order submission auto-creates the account on first order" remains the parked Acumatica boundary — an order needs an account, which conversion creates.)

**CRM-side order-on-behalf is complete (ORD-P1–P6).** Parked (Acumatica-gated, ORD-K-series): live `SalesOrder`/`Customer` create, first-order-creates-account, authoritative price/tax/shipping, inbound order reflection. Full split: `docs/ORDER_ON_BEHALF_BUILD_NOW_VS_ACUMATICA_PARKED_PLAN_2026-06-16.md`.

### §BUILD — Mobile partials build-out (2026-06-21)

The eight buildable "Partial" Mobile FRs are now built end-to-end (mobile `tsc --noEmit` clean; 155 unit tests green, 15 new; each gap's logic lives in a pure `src/lib` module with its own `node:test`). All eight are pushed to `codex/entra-calendar-governance`.

- **FR-MOB-007 / FR-MOB-046 — lead-inbox shortcut** (`fb7f5d8`): an always-present 1-tap "Lead inbox" entry on Today so the queue is never buried. The bottom-tab composition (Q-M-02) stays a product decision.
- **FR-MOB-035 — per-contact call/email** (`fb7f5d8`): tap-to-call / tap-to-email on each account contact (pure `contact-link.ts` tel:/mailto: builder).
- **FR-MOB-011 — source freshness** (`fb7f5d8`): explicit parked-vs-stale-vs-fresh classification on the site-card pill + ROSE step 1 — closes UX-M-003. A durable "stale" signal still depends on the Acumatica feed.
- **FR-MOB-058 — RD dashboard** (`76e2921`): a role-gated "Director overview" (`app/rd-dashboard.tsx`) rolling up pipeline, training, and cross-module exceptions from the RD-scoped reporting endpoints; revenue parked on Acumatica.
- **FR-MOB-036 — account detail tabs** (`d0bde8d`): Overview / Sales / Consignment / History via a new `SegmentedTabs` primitive; Consignment greys out with no sites; Sales $ totals parked on Acumatica.
- **FR-MOB-028 — map pin precision + nav gate** (`e28aee1`): per-pin geocode precision surfaced; navigation blocks state-centroid pins and flags city-level pins as approximate. Final colours + street-level geocoding parked on the geocoding provider.
- **FR-MOB-047 — order polish** (`4f54538`): per-line notes + offline-queue parity (a save/submit that fails offline is persisted on-device and replayed from Sync Status). Live ERP placement stays Acumatica-parked.
- **FR-MOB-009 — iPad responsive** (`538a95b`): shared `Screen`/`ListScreen` cap + centre the content column on tablet (pure width hook). Pixel/device verification (landscape tab bar, hero gradients, safe-area insets) still needs a simulator.

**Adversarial review + hardening (commit `a01aa74`):** a 4-dimension review with an independent skeptic per finding confirmed 11 of 30 findings; the genuine in-scope ones are fixed — a NaN sync-timestamp guard (was silently "fresh"), mailto header-injection rejection, order-draft offline truncation + an explicit 7-day TTL, the consignment fetch narrowed by account name (so the page limit can't hide an account's sites), SegmentedTabs disabled-tab contrast, and a documented create-response-lost duplicate risk. Suite at 157/157.

**Idempotency follow-up shipped (2026-06-21, commit `520a33e`):** the create-response-lost duplicate risk is now closed at the source — an optional client idempotency key on `POST /api/v1/order-drafts` dedupes a replayed create (`OrderDraft.idempotencyKey` + `@@unique([createdByUserId, idempotencyKey])`, migration `20260621120000_add_order_draft_idempotency`), threaded from the mobile create through the offline replay (the same request object carries the key). Verified: orders regression 10/10 (incl. the new idempotency case) + dealer-portal orders 5/5; mobile 158/158.

**Still parked (external dependency, not a build gap):** order ERP placement/pricing + first-order account create (047); final pin colours + street-level geocoding (028); the durable "stale" expected-count signal (011) — all Acumatica/geocoding-provider. iPad **pixel** verification (009) needs hardware.

_To be completed during the review meeting._
