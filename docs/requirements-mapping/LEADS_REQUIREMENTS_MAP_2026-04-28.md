# Leads Requirements Map

Date: 2026-04-28

Scope:
- Pulse CRM lead intake through lead-to-customer readiness boundary
- Sources reviewed from the Dynamic AQS requirements-gathering corpus under `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings`
- Current implementation scan performed in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform`

Primary source artifacts reviewed for this map:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/PRD-Lead-To-Dealer.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Discovery Session 1_ Executive Vision, Objectives & Mobile Strategy.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/18 feb 2026 Discovery session 2.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/20 Feb session 3 _ Discovery session 3 _ Validations.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24 Feb 2026 Discovery session 4.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/session-13th-20thApril-2026.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/asiscustomerdocuments/New CRM Lead_Customer_Master_Datasheet (003).xlsx - Lead Onboarding Form.csv`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/asiscustomerdocuments/New CRM Lead_Customer_Master_Datasheet (003).xlsx - Lead Statuses.csv`

Implementation evidence reviewed:
- `apps/api/src/modules/leads/service.ts`
- `apps/api/src/modules/leads/http.ts`
- `apps/api/src/modules/leads/readiness.ts`
- `apps/api/src/modules/leads/file-ingest.ts`
- `apps/api/src/modules/leads/website-config.ts`
- `apps/api/src/modules/leads/alerts.ts`
- `apps/crm-web/src/components/leads/`
- `apps/api/test/leads.website-forms.regression.test.mjs`
- `apps/api/test/leads.import.regression.test.mjs`
- `apps/api/test/leads.workflow.regression.test.mjs`
- `apps/api/test/leads.readiness.regression.test.mjs`
- `apps/api/test/leads.activity-history.regression.test.mjs`
- `apps/api/test/leads.operations.regression.test.mjs`
- `apps/api/test/lead.classification.regression.test.mjs`

## Coverage statement

This map is intended to be the full implementation-side traceability pass for lead requirements currently evidenced in the meeting corpus. It includes:
- intake requirements
- workflow and stage requirements
- source and routing requirements
- duplicate and import requirements
- CIS and onboarding-boundary requirements
- operational visibility and alerting expectations

It does not close downstream customer, dealer portal, consignment, ERP, or marketing-platform requirements unless they are explicitly part of the lead-owned boundary.

## Newly reinforced from the wider meeting corpus

- Pulse is expected to replace the current website -> HubSpot -> export -> Dropbox -> Dynamics chain, not coexist with it as the future-state owner.
- Lead stages are responsibility checkpoints, not a perfectly rigid linear pipeline. Discovery, CIS, and onboarding steps can happen out of order.
- Source continuity is operationally important. The team wants to know which branded website, show, or channel produced the lead without relying on memory.
- The field team wants faster intake from shows and business cards; Pulse now has a responsive OCR preview lane for manual intake, while mobile-native camera capture and durable media governance remain open.
- The onboarding milestones shown in older sheets still matter, even where the status vocabulary has been simplified in later artifacts.
- April 20 shifted emphasis from "forms exist" to "forms can be trusted enough to remove HubSpot."

## Current coverage map

| Requirement | Meeting / artifact evidence | Status | Current implementation evidence | Hardening / next action |
| --- | --- | --- | --- | --- |
| Direct branded website intake replacing HubSpot | `PRD-Lead-To-Dealer.md` states HubSpot elimination and direct web-form ingestion; `18 feb 2026 Discovery session 2.md` and `20 Feb session 3 _ Discovery session 3 _ Validations.md` validate the current HubSpot chain | Implemented | `apps/api/src/modules/leads/service.ts`, `apps/api/src/modules/leads/http.ts`, `apps/crm-web/src/components/leads/PublicWebsiteLeadCaptureForm.tsx`, `apps/api/test/leads.website-forms.regression.test.mjs` | Keep Pulse-native forms as the canonical future-state intake path |
| Per-website native form configuration, hosted preview, and embed readiness | `18 feb 2026 Discovery session 2.md` and `24 Feb 2026 Discovery session 4.md` reinforce many branded sites and source-specific tagging expectations | Partial | `apps/api/src/modules/leads/website-config.ts`, `apps/crm-web/src/components/leads/LeadWebsiteFormsWorkspace.tsx`, website-form regressions | Finish connection-status visibility, embed readiness checks, and cutover checklist |
| Per-site trusted-origin enforcement for public forms | April 20 raised reliability concerns before HubSpot shutdown; the branded-site rollout implies site-specific trust boundaries | Implemented | `apps/api/src/modules/leads/http.ts`, `apps/api/src/modules/leads/shared.ts`, `apps/api/test/leads.website-forms.regression.test.mjs` | Add rate limiting and abuse controls next |
| Source attribution by website, brand, campaign, and capture method | `18 feb 2026 Discovery session 2.md` asks for source, owner, intake time; `PRD-Lead-To-Dealer.md` calls out site / campaign / brand source continuity | Implemented | source fields in `apps/api/src/modules/leads/service.ts`, website submission metadata, import metadata, lead detail serialization | Clean up active vocabulary so legacy HubSpot migration values do not pollute future-state reporting |
| Manual lead intake with richer context and admin ownership fields | `18 feb 2026 Discovery session 2.md` lists owner, source, intake time, contact data, notes, discovery state; `24 Feb 2026 Discovery session 4.md` references lead intake master-sheet fields | Partial | `apps/crm-web/src/components/leads/LeadWorkspace.tsx`, `apps/api/src/modules/leads/service.ts` | Tighten requiredness and backend validation against the validated intake policy |
| CSV / XLSX import with governed source mapping | `PRD-Lead-To-Dealer.md` and early meetings treat roster and imported-source intake as first-class | Implemented | `apps/api/src/modules/leads/file-ingest.ts`, `apps/crm-web/src/components/leads/LeadImportWorkbench.tsx`, `apps/api/test/leads.import.regression.test.mjs` | Preserve as the canonical governed import path |
| Persisted import review with duplicate decisions | `PRD-Lead-To-Dealer.md` requires duplicate and roster-aware handling; operational meetings reinforce review before commit | Implemented | import review and commit flows in `apps/api/src/modules/leads/service.ts`, import regressions | Add merge / update semantics only after cross-entity governance is approved |
| Duplicate handling across website, manual, import, and account contexts | `20 Feb session 3 _ Discovery session 3 _ Validations.md` and `24 Feb 2026 Discovery session 4.md` reflect cross-channel duplicate pain | Implemented to lead-owned boundary | website duplicate review with enrich-existing, import duplicate review with enrich-existing and account-aware use-existing closure, manual duplicate preview/block/create-new acknowledgement with selected account context, manual enrich-existing lead resolution, duplicate-enrich / duplicate-override history labels, and OCR duplicate preview in `apps/api/src/modules/leads/service.ts`, `apps/api/src/modules/leads/ocr.ts`, `apps/crm-web/src/components/leads/LeadWorkspace.tsx`, `apps/api/test/leads.website-forms.regression.test.mjs`, `apps/api/test/leads.import.regression.test.mjs`, `apps/api/test/leads.workflow.regression.test.mjs`, `apps/api/test/leads.activity-history.regression.test.mjs` | Later merge / customer-side governance remains parked until cross-entity rules are approved |
| Lifecycle controls with active, parked, closed, reopen, and audit trail | lead status sheet plus meeting discussion on visibility, cold leads, and inactive handling | Implemented | lifecycle transitions, history feed, inactive filtering in `apps/api/src/modules/leads/service.ts`, `apps/api/test/leads.workflow.regression.test.mjs`, `apps/api/test/leads.activity-history.regression.test.mjs` | Add richer archived reporting and leadership analytics |
| Workflow queue and SLA-backed next action visibility | `18 feb 2026 Discovery session 2.md` asks for visibility into waiting-for-discovery and related next steps | Implemented | workflow queue logic in `apps/api/src/modules/leads/service.ts`, list-first `Lead Work Queue` in `apps/crm-web/src/components/leads/LeadWorkspace.tsx`, action-first lead detail in `apps/crm-web/src/components/leads/LeadRecordWorkspace.tsx`, `apps/api/test/leads.workflow.regression.test.mjs`, `apps/crm-web/e2e/ux-clutter.spec.mjs`, `apps/crm-web/e2e/ux-depth.spec.mjs`, and `apps/crm-web/e2e/flows.spec.mjs` | Keep the queue fully backend-derived; rerun focused Browser/Playwright lead route proof after host resource recovery, and expand downstream trigger clarity without moving reports/metrics back onto first paint |
| Discovery scheduling, completion, skip-with-reason, and timeline visibility | `24 Feb 2026 Discovery session 4.md` describes discovery as the first operational step; `18 feb 2026 Discovery session 2.md` asks for discovery scheduled / complete visibility | Implemented | discovery actions and detail fields in `apps/api/src/modules/leads/service.ts`, lead detail + workflow tests | Finalize any remaining strictness rules for optional vs mandatory discovery paths |
| Non-linear discovery, CIS, and onboarding sequence | `18 feb 2026 Discovery session 2.md` explicitly says steps do not always happen in the preferred order | Partial | readiness and workflow already allow some flexible progression in `apps/api/src/modules/leads/readiness.ts` and `service.ts`; lead detail now opens action-first on the recommended work lane without forcing a linear overview-first sequence | Remove remaining rigid assumptions from analytics, gating, and operator UX |
| CIS milestone tracking without making CIS equal to customer activation | `PRD-Lead-To-Dealer.md` says lead remains a lead until first order; `18 feb 2026 Discovery session 2.md` and `24 Feb 2026 Discovery session 4.md` reinforce CIS fields and dates | Implemented | lead stage model, readiness boundary, CIS integration points in `apps/api/src/modules/leads/service.ts`, `apps/api/src/modules/leads/readiness.ts`, related regressions | Keep ERP activation and customer conversion tied to first-order boundary |
| Keep raw payment data out of Pulse CRM truth | `18 feb 2026 Discovery session 2.md` calls out CIS records with credit cards and the need to avoid that pattern | Partial | current CIS boundary already parks provider card capture and keeps tokenized / payment-safe direction elsewhere in the repo | Keep raw card data out of CRM and document the approved hosted-capture boundary when finalized |
| Onboarding readiness milestones tied to lead-to-customer progression | `18 feb 2026 Discovery session 2.md` describes onboarding tab milestones; `24 Feb 2026 Discovery session 4.md` references discovery, CIS, and training-completed flags | Partial | readiness checklist and conversion prep in `apps/api/src/modules/leads/readiness.ts`, `apps/crm-web/src/components/leads/LeadOnboardingReadyPanel.tsx`, readiness regressions | Align checklist labels and completion evidence more closely to meeting-backed milestone names |
| Lead history feed and meaningful activity audit | operators need timeline visibility; meetings repeatedly complain about fragmented manual notes and delayed visibility | Implemented | `apps/api/src/modules/leads/service.ts`, `apps/crm-web/src/components/leads/ActivityManager.tsx`, `apps/api/test/leads.activity-history.regression.test.mjs` | Expand activity depth for more admin edits and public-form operational events |
| Immediate operational alerts for new leads and workflow movement | `PRD-Lead-To-Dealer.md` calls for immediate alerts; `session-13th-20thApril-2026.md` keeps real-time reliability in focus | Partial | alert record and queue foundation in `apps/api/src/modules/leads/alerts.ts`, `apps/api/test/leads.operations.regression.test.mjs` | Replace preview-only behavior with real provider-backed delivery once approved |
| Mobile badge / business-card capture from the field | `18 feb 2026 Discovery session 2.md` explicitly asks for photo capture of badge or business card into lead creation | Partial | responsive New Intake OCR preview in `apps/crm-web/src/components/leads/LeadWorkspace.tsx`, OCR API in `apps/api/src/modules/leads/ocr.ts`, PyMuPDF/Tesseract/Pillow processor in `apps/api/scripts/ocr_processor.py`, regression in `apps/api/test/leads.workflow.regression.test.mjs` | Add mobile-native camera capture, retention/media storage, source event metadata, and deeper OCR review queue later |
| Routing basis for Strategic Growth vs TM ownership | `PRD-Lead-To-Dealer.md` references routing / roster hierarchy; `24 Feb 2026 Discovery session 4.md` and March mobile sessions show rule drift between geography, service-tech count, and team ownership | Decision | current code prefers governed routing policy and service-tech-count posture in `apps/api/src/modules/leads/service.ts` | Lock the approved default routing basis and exception model in writing |
| Homeowner vs contractor segmentation in intake and reporting | `24 Feb 2026 Discovery session 4.md` and source artifacts distinguish contractor vs other intake patterns; website forms also reflect separate inquiry flows | Partial | form modes, inquiry options, and website validation in `apps/api/src/modules/leads/website-config.ts`, `service.ts`, and website-form regressions | Harden downstream analytics dimensions and admin-configured segmentation rules |
| Lead-to-training trigger at the right boundary | `PRD-Lead-To-Dealer.md` and `24 Feb 2026 Discovery session 4.md` connect first-order onboarding to training, while earlier meetings also mention initial online training | Partial | readiness and conversion prep reference training-bound milestones, but not full training-evidence closure | Move from checklist-only indicators toward verified training-session evidence |

## Status summary

| Status | Count |
| --- | ---: |
| Implemented | 9 |
| Partial | 9 |
| Missing | 1 |
| Decision | 1 |
| Blocked | 0 |

## Easy-to-miss gaps surfaced by the meeting corpus

- The forms problem is not only "build a form." It is "build a form reliable enough to remove HubSpot without losing trust."
- Dynamic thinks about lead phases as shared operational ownership, not just a sales Kanban.
- Badge and business-card capture is real field demand; the repo now ships a first responsive OCR preview lane, but mobile capture and durable media governance are still not complete.
- The lead milestones in older onboarding sheets still matter even where the final stage model is cleaner.
- Training readiness is still only partially evidenced from the lead side.

## Hardening priority to approach production confidence

1. Finish website cutover hardening: persisted telemetry, HubSpot parallel-run confidence, production notification delivery, and external / edge rate limiting if horizontally scaled.
2. Finish duplicate governance beyond preview/blocking: account-aware resolution, richer duplicate history, and later merge / customer-side governance.
3. Tighten manual-intake requiredness, durable OCR/media provenance, and admin edit history completeness.
4. Replace checklist-only onboarding / training assumptions with stronger downstream evidence.
5. Lock routing-basis and segmentation decisions that still drift across meeting artifacts.

## 100% closure slices

Leads closure is tracked through `L1`, `L2`, `L3`, `L4`, and the cross-cutting `X1` RBAC / audit gate in `docs/FUNCTIONAL_GAPS_AND_NEXT_SLICES_2026-04-28.md`.

| Slice | Requirement rows closed when complete | Acceptance criteria | Blocked decisions / dependency notes | Regression command |
| --- | --- | --- | --- | --- |
| `L1` Website cutover controls | Direct branded website intake; per-website configuration; trusted-origin enforcement; submission outcome proof | Site readiness is visible per branded website, public submissions are origin-gated and rate-limited, admins can see embed/origin health, and cutover evidence supports HubSpot parallel-run comparison | Historical cutover telemetry, external edge rate limiting, HubSpot comparison format, and production notification provider are still decisions/dependencies | `pnpm --filter @pulse/api test:leads` |
| `L2` Duplicate and audit governance | Duplicate handling across website/manual/import/account contexts; import review; lead history and admin-edit audit | Website, manual, import, and OCR intake expose duplicate candidates or audited enrich/create-new decisions; account-aware resolution is explicit; admin edits and stage moves are durable in history | Cross-entity merge, customer-side relink, import precedence, and source-run provenance require sign-off before deeper merge behavior | `pnpm --filter @pulse/api test:leads` |
| `L4` Mobile OCR card and badge capture | Mobile badge/business-card capture; source attribution by capture method; duplicate detection before commit | Captured media creates a reviewed draft, users can correct extracted fields before commit, duplicates are shown before create, and committed records preserve capture/event metadata | Mobile-native camera UX, retention policy, storage provider, and OCR provider escalation remain open | `pnpm --filter @pulse/api test:leads`; add `pnpm --filter @pulse/crm-web test:e2e` when responsive capture UX changes |
| `L3` Intake policy and readiness evidence | Manual intake requiredness; non-linear milestone readiness; homeowner/contractor segmentation; lead-to-training trigger | Backend validation matches approved intake policy, segmentation is reportable, readiness uses downstream CIS/training evidence, and routing precedence is documented and enforced consistently | Strategic Growth vs TM vs service-tech-count precedence, discovery strictness, and active lead-source vocabulary need final written approval | `pnpm --filter @pulse/api test:leads` and `pnpm --filter @pulse/api test:readiness` |
| `X1` RBAC and audit gate | Sensitive lead reads/writes, audit, masking, and parked boundaries | Permission denial is proven at API level, denied actions are audited where applicable, sensitive fields are masked, and parked marketing / provider items are not exposed as fake active behavior | Canonical role/action matrix and provider identity decisions may gate final pilot readiness | `pnpm --filter @pulse/api test` |

Rows that remain marketing-platform, SMS, promotion, campaign, or homeowner-response product scope are parked outside the current Leads closure count unless Dynamic AQS explicitly moves them from parked PRDs into the active lead module.
