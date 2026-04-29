# Training Requirements Map

Date: 2026-04-28

Scope:
- Pulse CRM training catalog, program, scheduling, execution, certification, proof, and reporting boundary
- Sources reviewed from the Dynamic AQS requirements-gathering corpus under `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings`
- Current implementation scan performed in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform`

Primary source artifacts reviewed for this map:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Discovery Session 1_ Executive Vision, Objectives & Mobile Strategy.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24 Feb 2026 Discovery session 4.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/25 Feb 2026 Session 5.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/17th March  session 10-To-Be consognment and App.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24th March - Session 12 - Reporting and Widen .md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/session-13th-20thApril-2026.md`

Implementation evidence reviewed:
- `apps/api/src/modules/training/service.ts`
- `apps/api/src/modules/training/http.ts`
- `apps/crm-web/src/components/training/TrainingWorkspace.tsx`
- `apps/crm-web/src/components/training/TrainingSessionSchedulerModal.tsx`
- `apps/crm-web/src/components/training/TrainingSessionExecutionModal.tsx`
- `apps/crm-web/src/components/training/TrainingCertificationOpsModal.tsx`
- `apps/crm-web/src/components/training/CustomerTrainingHistory.tsx`
- `apps/api/test/training.regression.test.mjs`
- `apps/api/test/training.penetration.regression.test.mjs`
- `apps/api/test/training.recertification.regression.test.mjs`
- `apps/api/test/training.proof-upload.regression.test.mjs`

## Coverage statement

This map is the full implementation-side traceability pass for training requirements currently evidenced in the meeting corpus. It includes:
- catalog and training-type requirements
- program and session requirements
- training calendar / Outlook boundary requirements
- certification and recertification requirements
- proof, reporting, and exception-management requirements
- training-adjacent value-delivered expectations where they touch CRM requirements

It does not close external training-site replacement, provider meeting-policy finalization, or a full technician-master design unless current code evidence exists.

## Newly reinforced from the wider meeting corpus

- Training is a retention and growth motion, not just a calendar function.
- Leadership wants one place to answer "how many trainings did we do?" without calling each TM.
- Dynamic wants CRM-first scheduling that can reflect to Outlook, not a permanently Outlook-first source of truth.
- The meeting corpus adds more nuance around training-adjacent giveaways, contests, and value delivered than the older map captured.
- Certification matters, but the team does not want a heavyweight technician-master burden unless it clearly pays off.
- April 20 strengthened the need for reporting and event visibility, not just session CRUD.

## Current coverage map

| Requirement | Meeting / artifact evidence | Status | Current implementation evidence | Hardening / next action |
| --- | --- | --- | --- | --- |
| Account-centric training model | meetings consistently describe training against customer accounts after onboarding / activation boundaries | Implemented | `apps/api/src/modules/training/service.ts`, `apps/crm-web/src/components/training/CustomerTrainingHistory.tsx`, training regressions | Keep the account boundary explicit |
| Territory-linked training ownership and visibility | meetings assume TM / RD ownership of ongoing training cadence and visibility | Implemented | training account / owner linkage in service layer and reporting read models | Add richer TM / RD reporting and scope confidence |
| Centralized training workspace | multiple meetings require one place to manage scheduling, completion, exceptions, and history | Implemented (core) | `apps/crm-web/src/components/training/TrainingWorkspace.tsx`, training API + regressions | Keep expanding from real backend state only |
| CRM-first scheduling with future Outlook reflection | `Discovery Session 1_ Executive Vision, Objectives & Mobile Strategy.md`, `25 Feb 2026 Session 5.md`, and `24 Feb 2026 Discovery session 4.md` all point to scheduling disconnect pain | Partial | scheduler modal, training session APIs, shared calendar foundations | Complete pilot-hardening and provider-status visibility |
| Admin-managed catalog with categories, training types, and templates | `24 Feb 2026 Discovery session 4.md` asks for dropdown flexibility and adding / retiring trainings over time | Implemented | catalog management in `apps/api/src/modules/training/service.ts`, `apps/api/test/training.regression.test.mjs` | Add fuller lifecycle-governance UX and housekeeping depth |
| Standard training types plus customizable presentation options | `24 Feb 2026 Discovery session 4.md` asks for standard dropdowns plus custom presentations for account-specific needs | Partial | current model supports categories, templates, and seeded training types | Add explicit custom-presentation handling and subtype governance |
| Certification tracks and certification history | meetings repeatedly stress certification value and external training-site linkage | Implemented (core) | certification record model, certification ops modal, regressions for cert queues and status | Deepen printable / exportable / authority rules and coexistence policy |
| Lightweight completion for ordinary trainings | `24 Feb 2026 Discovery session 4.md` says most trainings do not need quiz-heavy evaluation | Implemented | execution flow and completion states in service layer and UI | Preserve the simple completion path while keeping certification-specific depth separate |
| Mobile-ready execution with check-in / check-out, notes, and quick follow-up | executive mobile session and March mobile walkthrough both validate this pattern | Partial | execution modal, session lifecycle, follow-up tasks, proof hooks | Bring the same rigor into the actual mobile / field slice later |
| Voice-to-text and quick field logging | `Discovery Session 1_ Executive Vision, Objectives & Mobile Strategy.md` and March mobile session both validate dictation | Missing | no production voice transcription workflow found in current training module | Park until the mobile field execution slice opens |
| Distinguish training from site visits and other activity types | meetings and reporting expectations require this distinction | Implemented | training service separates session kinds; regressions verify history counting behavior | Preserve distinction in reporting and calendar surfaces |
| Quarterly / six-month no-training exception reporting | `24 Feb 2026 Discovery session 4.md` explicitly asks for red-flag reporting when accounts go too long without training | Partial | overdue program, recertification, penetration, and queue foundations exist in service layer and regressions | Build leadership-grade exception and alert views next |
| Training proof capture and storage | current hardening plus meeting expectations support evidence capture for field execution | Implemented (review-governed foundation) | `apps/api/test/training.proof-upload.regression.test.mjs`, proof storage, proof review, proof download/export, checksum validation, and rejected-proof exception surfacing in `apps/api/src/modules/training/service.ts`, approve/reject/download controls in `apps/crm-web/src/components/training/TrainingSessionExecutionModal.tsx` | Add retention policy and packaging depth |
| Training hours / penetration / compliance reporting | `24th March - Session 12 - Reporting and Widen .md` and April sessions emphasize executive and TM / RD reporting | Implemented (foundation) | penetration, recertification, overview read models, compliance hours rollups by account, territory, trainer, training type, and state, plus leadership-ready account export rows with owner scope, risk level, proof gaps, cadence, certification, and hours fields in `apps/api/src/modules/training/service.ts` and `apps/api/test/training.regression.test.mjs` | Add downloadable file packaging / scheduled delivery only after report distribution requirements are approved |
| Rich attendee / technician certification handling without full technician-master overload | `24 Feb 2026 Discovery session 4.md` wants useful certification counts and traceability, while warning that tracking every technician exhaustively is painful | Partial | attendee count exists and certification records exist, but no rich participant roster model was rediscovered | Add participant depth before calling certification ops complete |
| External training website coexistence and certification sync | `24 Feb 2026 Discovery session 4.md` says the training website may go away but must be accounted for | Partial | current code keeps a clean boundary, but no full coexistence / import policy is implemented | Produce an explicit remain / integrate / replace decision memo |
| Training-adjacent contests, giveaways, and value delivered | `24 Feb 2026 Discovery session 4.md` and `25 Feb 2026 Session 5.md` want these tracked, but also say they are not the same thing as training itself | Missing | no dedicated value-delivered or contest model found in the training module | Model as linked account-history / marketing / training-adjacent records later, not as hidden training fields |
| Outlook / Teams / WebEx meeting-provider policy | meetings mention Outlook reflection plus Teams and WebEx usage, but the final provider policy is not fully settled | Decision | shared calendar foundations exist elsewhere in the repo, but no final training-specific provider policy is locked | Finalize allowed provider set, default behavior, and fallback rules |

## Status summary

| Status | Count |
| --- | ---: |
| Implemented | 7 |
| Partial | 7 |
| Missing | 2 |
| Decision | 1 |
| Blocked | 0 |

## Easy-to-miss gaps surfaced by the meeting corpus

- Training reporting and exception management are a core part of product value.
- The external training website is not a side note; it carries certification expectations and migration implications.
- Proof upload foundation now includes approve/reject review governance, audit evidence, checksum-validated download/export, and rejected-proof operational exception surfacing; retention policy remains separate.
- Dynamic wants to understand the business value delivered around trainings, even when that should not become fake ROI precision.

## Hardening priority to approach production confidence

1. Finish proof retention workflow and downloadable leadership report packaging once distribution requirements are approved.
2. Add deeper attendee / certification operations without forcing a heavyweight technician-master too early.
3. Define external training-site coexistence and sync policy explicitly.
4. Keep CRM-first scheduling and Outlook reflection moving toward pilot-ready behavior.
5. Park contests / giveaways / value-delivered tracking as an adjacent model until its ownership boundary is approved.

## 100% closure slices

Training closure is tracked through `R1`, `R2`, `R3`, and the cross-cutting `X1` RBAC / audit gate in `docs/FUNCTIONAL_GAPS_AND_NEXT_SLICES_2026-04-28.md`.

| Slice | Requirement rows closed when complete | Acceptance criteria | Blocked decisions / dependency notes | Regression command |
| --- | --- | --- | --- | --- |
| `R1` Proof and reporting hardening | Proof capture governance; quarterly / six-month exception reporting; training hours / penetration / compliance reporting | Proof can be reviewed, downloaded/exported, retained under policy, and tied to session/certification outcomes; exception views answer overdue, no-training, recertification, trainer, territory, state, and session-type questions; leadership exports are reproducible | Storage provider, retention period, report-pack layout, certification authority rules, and export audience need approval where they affect compliance posture | `pnpm --filter @pulse/api test:training` |
| `R2` Participant and coexistence policy | Rich attendee / technician certification handling; custom presentations; external training-site coexistence; provider scheduling policy | Participant records support certification operations without forcing a heavyweight technician master; custom presentation subtype handling is explicit; remain / integrate / replace policy for the external training site is documented; provider status is visible when scheduling depends on Outlook/Teams/WebEx | External site future state, sync direction, participant requiredness, Outlook / Teams / WebEx policy, and default meeting behavior require written sign-off | `pnpm --filter @pulse/api test:training`; add `pnpm --filter @pulse/crm-web test:e2e` when scheduling UX changes |
| `R3` Adjacent value tracking | Contests, giveaways, value delivered | Value-delivered signals are stored as linked account-history or training-adjacent records, visible for account review, and excluded from core training completion/certification truth | Marketing vs Training Ops ownership, allowed value categories, compliance rules, and reporting audience need approval | `pnpm --filter @pulse/api test:training` |
| `Mobile / voice boundary` | Mobile-ready execution and voice-to-text | Existing execution remains mobile-safe; voice-to-text is either approved as part of the mobile field slice with provider/security coverage or explicitly parked outside Training closure | Mobile app offline model, voice transcription provider, recording retention, and privacy policy remain parked until mobile execution scope opens | Do not mark closed without a targeted mobile/field regression path plus `pnpm --filter @pulse/api test:training` |
| `X1` RBAC and audit gate | Sensitive training reads/writes, proof access, certification authority, and parked boundaries | API-level permission denial coverage exists for proof, certification, exports, and participant updates; denied actions are audited where applicable; provider/external-site gaps are visible and not faked in active UI | Canonical role/action matrix and certification authority rules may gate final pilot readiness | `pnpm --filter @pulse/api test` |

Training can only claim 100% closure when proof governance, leadership reporting, participant depth, coexistence policy, and adjacent value boundaries are explicit. Provider meeting sync and external website replacement should not be silently treated as complete until Dynamic AQS approves the operating model.
