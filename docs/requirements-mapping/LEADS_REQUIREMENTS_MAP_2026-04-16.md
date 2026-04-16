# Leads Requirements Map

Date: 2026-04-16

Primary source documents:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/LEAD_CAPTURE_MANAGEMENT_PRD.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/CIS_CREDIT_ONBOARDING_PRD.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/source_of_truth/LEAD_ACCOUNT_CONTACT_CRM_FLOW.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/18 feb 2026 Discovery session 2.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24 Feb 2026 Discovery session 4.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/05 March-session 8`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/asiscustomerdocuments/New CRM Lead_Customer_Master_Datasheet (003).xlsx - Lead Onboarding Form.csv`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/asiscustomerdocuments/New CRM Lead_Customer_Master_Datasheet (003).xlsx - Lead Statuses.csv`

## Newly surfaced or reinforced from meetings and shared artifacts

- Lead phases are operational responsibility checkpoints, not a rigid linear pipeline. Dynamic explicitly said discovery, CIS, and onboarding steps can happen out of order.
- Lead capture must support richer manual and mobile capture than the PRD alone suggests, including event/show badge or business-card capture into the app.
- CIS processing still has sensitive-card-data redaction problems in the current process; Pulse must keep raw payment data out of CRM.
- Dynamic’s onboarding/account screen historically tracked milestones like CIS received, discovery attended, initial online training, and first order. Those are real operational fields, not nice-to-have UI tags.
- The older onboarding sheet and newer status sheet drift. That means current implementation should favor the later validated lifecycle, but preserve the field coverage from the older sheets.

## Current coverage map

| Requirement | Meeting / artifact evidence beyond PRDs | Status | Current implementation evidence | Hardening / next action |
| --- | --- | --- | --- | --- |
| Direct branded website intake replacing HubSpot | Multiple meetings and approved sheets reinforce that native forms must replace current fragmented web intake | Implemented | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/leads/service.ts`, `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/leads/PublicWebsiteLeadCaptureForm.tsx`, website-form regressions | Keep this as the canonical web intake engine |
| Per-website native form configuration, preview, and embed | Dynamic runs many branded websites and expects Pulse-managed hosted forms | Partial | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/leads/LeadWebsiteFormsWorkspace.tsx`, website-config service | Add verified domain/origin rollout checks and website-connection governance |
| Native forms as real working intake, not static UI | User explicitly emphasized this; meetings support same | Implemented | Same code paths plus regression suite | Continue requiring backend-driven option lists and validation |
| Source attribution by site, brand, campaign, method | Lead source and provenance were repeatedly emphasized in meetings | Implemented | Lead source fields, website submission metadata, import metadata | Expand later into richer analytics and alerting |
| Manual intake with richer context (email, phone, affinity, ownership, source timing) | Session 2 and lead sheets make these fields explicit | Partial | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/leads/LeadWorkspace.tsx` | Tighten backend validation and requiredness based on approved intake policy |
| CSV/XLSX import with source-header mapping | Demo promise and shared materials reinforce this strongly | Implemented | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/leads/file-ingest.ts`, `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/leads/LeadImportWorkbench.tsx`, import regressions | Preserve as the canonical import path |
| Import review with duplicate/skip/use-existing decisions | Agent review and user priority confirm this is a production need, not an enhancement | Implemented | persisted import review runs in lead service and regression suite | Add merge/update semantics only after cross-entity rules are signed off |
| Generic dedupe across website/manual/import/customer contexts | Meetings imply duplicates happen across channels, not only website submissions | Partial | website duplicate review and import duplicate review exist | Build shared dedupe kernel with customer-aware resolution and merge rules |
| Lead lifecycle with active, parked, closed, reopen, not-interested | Later validated lifecycle is in the statuses sheet and meetings | Implemented | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/leads/service.ts`, workflow regressions | Add richer archived reporting and analytics |
| Non-linear discovery/CIS/onboarding progression | Michelle explicitly said the steps do not always happen in order | Partial | Current readiness and workflow support some flexibility | Remove any remaining rigid assumptions in forms, status gates, and analytics |
| Discovery scheduling and visibility | Meetings asked for discovery visibility and calendar awareness | Implemented | lead discovery scheduling plus centralized calendar integration | Keep discovery as lead-owned workflow truth |
| CIS attach + structured entry without storing raw card data | Session 2 made the current redaction pain explicit | Partial | CIS flow exists and keeps hosted payment/tokenization parked | Keep raw payment outside Pulse and formalize the approved capture boundary |
| Lead onboarding milestone tracking | Session 2 described onboarding-tab milestones clearly | Partial | readiness checklist exists | Align checklist items and labels fully to meeting-backed milestones |
| Initial online training as part of lead-to-customer journey | Shared onboarding sheet and meetings reinforce this | Partial | onboarding readiness currently uses three training items/checklist logic | Tie activation readiness to real training-session evidence rather than checklist-only state |
| Immediate BD-team alerting on website lead capture | Meetings and supplement want alerting/notification when things move | Partial | recipient configuration exists | Build real outbound alert dispatch once provider is approved |
| Mobile lead capture from badge/business-card photo | Session 2 wish list explicitly asks for it | Missing | No production mobile OCR capture path evidenced | Add to lead/mobile hardening plan, not as a hidden assumption |
| Routing basis for Strategic Growth vs TM split | Meetings still drift between trucks, service techs, and SGT/TM ownership | Decision | current code prefers service-tech count and territory policy | Lock the approved routing basis/default in writing before closure |
| Homeowner versus contractor segmentation in lead analytics and intake | Reporting master and meeting flow imply this distinction matters | Partial | form modes and options exist in native forms | Harden analytics dimensions and admin-configured segmentation rules |
| Map My Customer style field map for leads/customers | Lead + field ops meetings repeatedly reinforce this need | Missing | current map work is territory-centric rather than lead-mobile-centric | Build after territory/field map hardening is farther along |

## Meeting-to-implementation gaps that were easy to miss from PRDs alone

- Dynamic explicitly wants lead phase visibility as a responsibility chain, not only as a classic sales funnel.
- Initial online training is part of the lead curator team’s responsibility view, even though final activation belongs downstream.
- Badge/business-card OCR capture was a real wish, not just a generic AI idea.
- The current process still mixes CRM and spreadsheet notes, which means migration and operational discipline need stronger hardening than the PRD alone suggests.

## Hardening priority to approach 90%

1. Finish generic dedupe and merge governance across web/manual/import/customer flows.
2. Replace checklist-only training readiness with training-backed evidence.
3. Add verified website rollout controls and real alert delivery.
4. Lock routing basis and SGT/TM split decisions.
5. Harden onboarding milestone labels to the meeting-backed sequence.
6. Then tackle mobile lead capture and map parity.
