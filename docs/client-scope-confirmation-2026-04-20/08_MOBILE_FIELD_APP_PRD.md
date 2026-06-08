# Pulse Platform — Mobile Field App PRD

## 1. Document Control

| Field | Value |
|---|---|
| Version | 1.0 |
| Date | 2026-06-07 |
| Status | Scope confirmation draft for Dynamic AQS review |
| Module owner | Pulse delivery team |
| Primary reviewers | Dynamic AQS field leadership, Territory Managers, Regional Directors, operations lead |
| Related documents | `00_README_AND_MEETING_AGENDA.md`, `01_LEADS_PRD.md`, `02_TRAINING_PRD.md`, `03_TERRITORY_PRD.md`, `04_CALENDAR_PRD.md`, `05_CONSIGNMENT_PRD.md` |

---

## 2. Executive Summary

The Mobile Field App is the field-execution companion to Pulse CRM — not a standalone product and not a second copy of the web platform. It is the surface a Territory Manager or Regional Director opens in the truck, on a dealer shelf, and between stops to see what matters today, do the on-site work, and let that work flow back into Pulse cleanly. The app is built in React Native / Expo and shares the same governed API contracts as Pulse web, so every field action lands in the same operational truth the office sees.

The app today centres on a ranked "Today" home, a route/visit check-in flow, an on-site ROSE consignment audit, training execution, voice-note and business-card capture, and a phone-saved draft model that protects field work when signal is weak. It deliberately does the heavy back-office work — CIS administration, finance approval, account setup, warehouse creation in Acumatica, reporting administration — nowhere on mobile; those stay web-first. The goal of this module is to give the field one connected tool that is faster than paper, Outlook, and after-the-fact CRM entry, while never silently losing work done off-grid.

---

## 3. Module Objective

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

## 4. Scope Statement

### 4.1 Pulse Mobile Will Support

- a default "Today" home with one ranked **Start here** next-action card, priority leads, a metric strip (Open actions / SLA risk / ROSE / Accounts), nearby accounts, and a live-CRM-data status panel
- a first-class bottom-tab navigation contract covering the daily field surfaces (see Section 6.2 for the proposed contract)
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

### 4.2 This PRD Will Also Cover

- the intended navigation contract: which surfaces are first-class tabs versus launcher items, and how the current "core queues hidden behind More" problem will be fixed
- the one canonical draft/sync vocabulary that replaces the three inconsistent status languages in the current build
- how known field-flow dead-ends (business-card OCR commit, read-only lead detail, missing account-touch logging) become governed mobile requirements
- what Dynamic AQS needs to confirm before the mobile field scope is locked

### 4.3 Parked / Separate-Decision Dependencies

These items are part of the broader Pulse field vision but require a separate signed dependency decision before they are built. They are explicitly **not** assumed by this PRD:

- **Acumatica live inventory / SKU truth** — expected ROSE counts may be missing or stale until the Acumatica read integration is approved; the field flow must not block on it
- **Barcode / SKU mapping** — parked until product-mapping signoff; ROSE lines display SKU/barcode for reference only
- **Offline photo byte storage** — drafts are metadata-only by design today; no media bytes, base64, file URIs, or storage keys are persisted offline
- **Push notifications and deep links** — provider and notification governance not yet selected
- **Background upload / background sync worker** — sync is foreground/manual today
- **Route geographic optimization and geofencing** — interim ordering is by oldest last-touch; provider/rules decision pending
- **Acumatica warehouse creation, PO posting, and finance reconciliation** — back-office, web-first, outside the mobile app

---

## 5. Primary Future-State User Journeys

### 5.1 Journey A — Field User Opens "Today" And Starts The Right Work

1. The field user opens the app and lands on the "Today" home.
2. Pulse ranks route, lead, ROSE, and phone-saved work into one **Start here** next-action card.
3. The user sees priority leads, a metric strip (open actions, SLA risk, ROSE, accounts), and nearby accounts.
4. A live-CRM-data panel shows whether each section loaded, loaded partially, or failed.
5. The user taps the next action and is taken directly into the relevant flow.

### 5.2 Journey B — Territory Manager Runs An On-Site ROSE Audit

1. The TM opens the Consignment tab or a notification and selects a due ROSE site.
2. Pulse loads the scheduled audit and shows the expected-count source and its freshness.
3. **Step 1 — Counts:** the TM enters the physical count for each ROSE line; variance previews per line and in total.
4. **Step 2 — Notes:** the TM adds the short audit note the office needs.
5. **Step 3 — Evidence:** the TM attaches optional photos; a variance requires at least one discrepancy photo.
6. **Step 4 — Attest:** the TM types their name and confirms the on-site attestation.
7. **Step 5 — Submit:** Pulse uploads evidence and submits counts to CRM; CRM opens discrepancy / PO follow-up where variance exists. If CRM is unreachable, the audit is saved as a phone draft with counts, notes, attestation, and photo metadata.

### 5.3 Journey C — Field User Executes A Training Session

1. The user opens Training from the tab bar, Today quick action, account context, or a notification.
2. **Check in:** the user checks in to a scheduled session; CRM records the check-in.
3. **Details:** the user records attendee count and completion notes.
4. **Proof:** the user captures proof photos (camera/gallery) and proof-context notes.
5. **Follow-up:** the user optionally creates a follow-up task.
6. **Submit:** the session is completed back to CRM, or saved as a training phone draft if CRM is unreachable.

### 5.4 Journey D — Field User Checks In And Out Of An Account Visit

1. The user opens Route Plan and sees nearby work ordered by oldest last-touch.
2. The user starts a visit; the visit begins immediately on the phone and is created/checked-in through the CRM site-visit model.
3. GPS is captured when permission is granted; otherwise the visit is timed-only.
4. At checkout the user must enter notes; the visit is completed in CRM, or saved as a route phone draft to retry later.

### 5.5 Journey E — Field User Captures A Business Card As A Lead

1. The user opens card capture and uses camera, gallery, or a pasted-text fallback.
2. Pulse previews the extracted lead fields with per-field confidence and review reasons.
3. The user reviews the fields with the dealer or prospect.
4. The user commits the candidate into the governed CRM lead review queue, where duplicate review, classification, routing, and source attribution apply (see Q-M-01).

### 5.6 Journey F — Field User Captures A Voice Note

1. The user opens Voice Notes from the tab bar or a Today quick action.
2. The user records audio and edits the transcript text.
3. The user chooses a general CRM context or a specific account.
4. The note is structured and synced to Pulse CRM for office review. Automatic writeback into lead/account/training/consignment records is parked (see A-M-05).

### 5.7 Journey G — Field User Loses Signal And Recovers Work

1. The user completes ROSE, training, or route work while offline or on weak signal.
2. Pulse saves the work as a **Draft on phone** and confirms it only after durable phone storage has accepted it.
3. The header bell badges the unsynced count; the Sync Status screen lists each draft with what is saved and what it will do on retry.
4. When signal returns, the user retries; on success the item becomes **CRM saved** and leaves the draft inventory.

---

## 6. Functional Capabilities

### 6.1 Today Home And Field Orientation

Pulse Mobile will:

- open on a "Today" home as the default landing surface for every field session
- present exactly one ranked **Start here** next action drawn from route, lead, ROSE, and phone-saved work
- show priority leads, a four-tile metric strip, and nearby accounts for fast context
- show a live-CRM-data panel that reports section-level load status (ready / partial / failed) so a single failing endpoint never blanks the workspace
- degrade by section: leads, accounts, queue, consignment sites, and consignment work load independently

### 6.2 Navigation Contract (First-Class Tabs vs. Launcher)

Pulse Mobile will define one explicit navigation contract. The current build hides core queues (Leads, Accounts, Training, Voice Notes) behind "More," which buries primary daily work; this PRD treats that as a defect to fix. The proposed contract:

- **First-class bottom tabs (daily field surfaces):** Today, Route, Consignment, Training, plus one launcher tab
- **Launcher / "More" surface (focused or occasional work):** Voice Notes, business-card OCR review, Sync Status, Asset Library, and any secondary queue
- **Lead inbox placement is an open decision (Q-M-02):** the lead queue is core daily work and should not be buried; whether it is promoted to a first-class tab or surfaced via Today + bell needs Dynamic AQS confirmation
- a persistent header bell will remain available across surfaces, badging phone-saved drafts and opening the notifications center

### 6.3 ROSE Consignment Audit

Pulse Mobile will:

- load due/active ROSE sites and the scheduled audit from CRM
- show the expected-count source and freshness, and require manual verification when the source is parked or stale
- present a 5-step gated workflow (counts → notes → evidence → attest → submit) where each step gate must be satisfied to advance
- support line-item counts with per-line and total variance preview, shown before any counting begins
- submit balanced counts as a confirmed true-up and any shortage/overage as an open reconciliation so PO/discrepancy follow-up stays visible
- capture general and discrepancy evidence photos and upload them with the audit when CRM is reachable
- require a typed attestation name and confirmation before submit

### 6.4 Training Execution

Pulse Mobile will:

- load formal training sessions (separate from route site-visits) and show scheduled / checked-in / overdue counts
- present a 5-step workflow (check in → details → proof → follow-up → submit)
- capture attendee count and completion notes, with clear required-field guidance
- support proof-photo upload (camera/gallery) within mobile caps and carry the proof count into completion
- allow an optional inline follow-up task at completion
- complete the session back to CRM or preserve it as a training phone draft on failure

### 6.5 Route And Visit Execution

Pulse Mobile will:

- order nearby accounts by oldest last-touch as an interim, provider-neutral stop list
- start a visit immediately on the phone and create/check-in through the CRM site-visit model
- capture foreground GPS when permitted, with a timed-only fallback that never blocks the visit
- require checkout notes before completion
- complete the visit in CRM or save a retryable route phone draft, and show a completed-today review list

### 6.6 Field Capture (Voice Note And Business Card)

Pulse Mobile will:

- capture a voice note (audio + editable transcript), scope it to general CRM or an account, and sync it for office review
- capture a business card via camera, gallery, or pasted text and preview extracted lead fields with confidence and review reasons
- route business-card candidates into the governed CRM lead workflow rather than creating a lead silently on the device
- enforce capture guardrails: images only, size caps, and capped pasted text

### 6.7 Lead And Account Field Activity (Gap-Closure Requirements)

The current build leaves several field actions unfinished. Pulse Mobile will close them as governed requirements:

- **Business-card OCR commit:** define and build the review-queue commit path so card capture no longer dead-ends on a disabled button (current state: capture and preview work, but "Create lead" is disabled)
- **Mobile lead activity logging:** lead detail is read-only today; define mobile call disposition, next-step capture, and stage change so a field user can log a lead interaction on the spot
- **Account-touch logging:** define lightweight account-touch logging so account context is not write-only on mobile
- **Day-agenda surface:** there is no day-agenda/calendar surface on mobile today; define whether the field user needs an on-device day view (see Q-M-04)

### 6.8 Canonical Draft / Sync State And "My Work"

The build currently shows three inconsistent status vocabularies ("Draft on phone / CRM saved"; "Will retry / CRM pending / local_only"; "Live CRM data ready / partial / failed"). Pulse Mobile will collapse these into **one canonical field-facing model**:

- **Saved on phone** — the work is done but not yet in CRM
- **Sending** — a sync attempt is in progress
- **CRM saved** — the API accepted the work and the office can see it
- **Needs retry** — a recoverable failure; the user can retry when signal is stable
- **Sign in again** — an auth/session failure, kept distinct from network failure
- **Needs review** — CRM reported a conflict or validation issue; compare before discarding
- a single Sync Status screen will be the one "my work" inventory, showing each draft's contents (ROSE variance summary, route timed/GPS summary, training completion summary), retry, and discard controls
- the live-CRM-data load panel will use this same vocabulary so the user learns one language

### 6.9 Offline And Reliability Behaviour

Pulse Mobile will:

- persist route visits, ROSE drafts, and training completions locally and report "Saved on phone" only after durable native storage has accepted the draft
- keep drafts text/metadata-only: no media bytes, base64, file URIs, preview URIs, or storage keys are stored offline
- cap draft payload and queue size, redact account/customer names in local draft titles, and expire stale drafts (route drafts and ROSE/training drafts age out on defined windows)
- reset stuck "sending" drafts back to "Saved on phone" after reload, and fall back to in-memory drafts with a clear warning if local storage cannot be confirmed

---

## 7. Business Rules Pulse Will Enforce

| # | Rule |
|---|---|
| BR-M-01 | The mobile app is a field-execution companion to Pulse CRM; back-office work (CIS, finance, account setup, Acumatica warehouse creation, reporting administration) is web-first and out of mobile scope. |
| BR-M-02 | Every field action will be written through the same governed Pulse API contracts and rules used by the web platform; mobile will not invent parallel data paths. |
| BR-M-03 | A ROSE audit will not be submittable until all line counts, the audit note, attestation name, and attestation confirmation are present, and a variance will require at least one discrepancy photo. |
| BR-M-04 | A ROSE variance will submit as an open reconciliation so PO/discrepancy follow-up remains visible; a balanced count will submit as a confirmed true-up. |
| BR-M-05 | A route visit will require checkout notes before completion. |
| BR-M-06 | Business-card capture will be preview-first; a lead will only be created through the governed CRM review/routing flow, never silently on the device. |
| BR-M-07 | Field work will never be silently lost: when CRM is unreachable, work is preserved as a phone draft and "CRM saved" is shown only after the API accepts it. |
| BR-M-08 | Offline drafts will be metadata/text-only; no media bytes, base64, file URIs, or storage keys will be stored on the device until an approved encrypted storage adapter exists. |
| BR-M-09 | One canonical draft/sync vocabulary will be used everywhere in the app; the three legacy status vocabularies are not permitted in field-facing copy. |
| BR-M-10 | The API base URL will be restricted to approved Pulse hosts over HTTPS (localhost permitted for QA only). |
| BR-M-11 | Parked dependencies (Acumatica truth, SKU mapping, push, background sync, offline media, route optimization) will not be presented as complete in the app or in progress reporting. |

---

## 8. Data And Integration Highlights

At business level, this module will depend on and feed the following:

| Area | Proposed Pulse Mobile Role |
|---|---|
| Leads | Mobile reads the lead queue/detail and feeds card-capture candidates and (future) field lead activity into the governed lead workflow |
| Accounts | Mobile reads account context and feeds visit/touch activity; account detail shows embedded training context |
| Territory | Mobile uses territory truth for which sites, accounts, and queues a field user sees |
| Consignment | Mobile reads due ROSE sites and submits counts, notes, attestation, and evidence; CRM owns discrepancy and PO follow-up |
| Training | Mobile executes formal sessions (check-in / proof / complete) and route visits through the shared `site_visit` model |
| Digital Assets | Mobile searches approved assets and creates customer-safe share links |
| Sync / Drafts | Mobile owns the phone-saved draft inventory and retries into CRM; CRM owns conflict policy (parked) |
| Acumatica | Mobile displays expected-count source/freshness only; inventory truth, PO posting, and reconciliation stay back-office (parked) |

---

## 9. Assumptions To Confirm

| # | Assumption | Why It Matters |
|---|---|---|
| A-M-01 | The primary mobile persona is the Territory Manager (field-first, often driving, glanceable UI), with Regional Directors as a secondary field user. | This drives information architecture, default surfaces, and the ranking of "Start here." |
| A-M-02 | "Today" home is the correct default landing surface, not a map or calendar. | The old master PRD assumed a map/calendar-centric app; the build is Today-centric and this PRD specs the built model. |
| A-M-03 | ROSE is the only consignment audit type the field needs on mobile; BLUE/PURPLE/SAND remain web/back-office. | This bounds consignment mobile scope and field training. |
| A-M-04 | Route stop ordering by oldest last-touch is acceptable as an interim until geographic optimization is approved. | This sets field expectations before a maps provider decision. |
| A-M-05 | Voice notes and card capture are office-review inputs; automatic writeback into records is a later, separately approved behaviour. | This bounds the AI/structuring scope and avoids unreviewed data entering records. |
| A-M-06 | Offline drafts being metadata-only (no photo bytes) is acceptable for launch, with photos uploading only when CRM is reachable. | This affects how a TM works a site with no signal and when evidence is guaranteed to arrive. |
| A-M-07 | Authentication uses the same credentials as Pulse web, with a host-restricted, switchable API base URL for QA. | This affects login UX, environment safety, and field support. |

---

## 10. Open Questions For Dynamic AQS Decision

| # | Question | Options To Confirm | Why Decision Is Needed |
|---|---|---|---|
| Q-M-01 | What is the approved mobile path for committing a captured business card into a lead? | review queue in CRM web / mobile-side review commit / desk re-entry | Card capture currently dead-ends on a disabled button; the commit contract must be confirmed. |
| Q-M-02 | Where should the lead inbox live in the navigation contract? | first-class bottom tab / surfaced via Today + bell / launcher item | The lead queue is core daily work and must not be buried as it is today. |
| Q-M-03 | What mobile lead activity should a field user be able to log on the spot? | call disposition only / disposition + next step / disposition + next step + stage change | Lead detail is read-only today; this defines mobile lead-activity scope. |
| Q-M-04 | Does the field user need an on-device day-agenda/calendar surface? | required day view / read-only schedule strip / not needed on mobile | There is no day-agenda surface on mobile today; the master PRD assumed a full calendar. |
| Q-M-05 | What is the canonical draft/sync vocabulary to adopt platform-wide? | the proposed set in 6.8 / an amended set / align to a web-side term set | Three inconsistent vocabularies exist today and must converge. |
| Q-M-06 | What push provider and notification governance should mobile use? | Expo Push / FCM+APNs / deferred until a later gate | Determines whether field alerts are real-time and which infrastructure dependency is taken. |
| Q-M-07 | When are offline photo bytes and background sync needed for launch? | required at launch / fast-follow / later phase | These are parked today; confirming priority sets the storage/security and background-work roadmap. |

---

## 11. Later-Phase / Separate Decision Items

These items may still belong in the broader Pulse mobile roadmap, but will not be assumed as finalized by this PRD:

- Acumatica live inventory/SKU truth on mobile and barcode/SKU scanning
- offline photo/media byte storage with an encrypted, file-backed adapter
- push notifications, deep links, and background upload/sync workers
- route geographic optimization, geofenced auto check-in, and navigation handoff
- automatic AI writeback from voice notes/card capture, with an office approval UI
- offline conflict-merge rules and server-side conflict resolution
- mobile commerce/checkout (hand off to Dealer Portal rather than becoming the dealer checkout app)
- Android emulator/device QA hardening and French-language support for Canada

---

## 12. Approval Checklist

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
| UX-M-003 | Stale Acumatica data warning missing on ROSE audit expected-count screen | Mobile app | Yes | Open |

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
