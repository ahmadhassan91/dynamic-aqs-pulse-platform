# Leads Requirements Map

Date: 2026-04-15

Primary source documents:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/LEAD_CAPTURE_MANAGEMENT_PRD.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/CIS_CREDIT_ONBOARDING_PRD.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/source_of_truth/LEAD_ACCOUNT_CONTACT_CRM_FLOW.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/18 feb 2026 Discovery session 2.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/05 March-session 8`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/13th March Discovery Session 9.md`

| Requirement | Source | Status | Implementation Evidence | Hardening / Next Action |
| --- | --- | --- | --- | --- |
| Direct branded website intake replacing HubSpot | Lead PRD + March session 8 | Implemented | `apps/api/src/modules/leads/service.ts`, `apps/crm-web/src/components/leads/PublicWebsiteLeadCaptureForm.tsx`, `apps/api/test/leads.website-forms.regression.test.mjs` | Keep this as the canonical intake path |
| Source attribution by site, brand, campaign, capture method | Lead PRD + discovery meetings | Implemented | Lead schema source fields, website submission metadata, website-form regression suite | Ready for reporting expansion |
| CSV/XLSX import with header mapping | Lead PRD + approved sheets | Implemented | `apps/api/src/modules/leads/file-ingest.ts`, `/leads/import`, `apps/api/test/leads.import.regression.test.mjs` | Keep this as the canonical import path |
| Lead lifecycle and active/parked/closed controls | Lead PRD | Implemented | `apps/api/src/modules/leads/service.ts`, `leads.workflow.regression.test.mjs`, `leads.activity-history.regression.test.mjs` | Add richer archived reporting and lifecycle analytics |
| Workflow queue and SLA policy | Lead PRD | Implemented | routing policy + workflow queue APIs, workflow regressions, `/leads/activities` | Add alert delivery when provider is approved |
| Duplicate handling for repeat website form submissions | Lead PRD dedupe requirement | Implemented | website duplicate attach/review/relink flow and regressions | Expand beyond website submissions |
| First-order conversion boundary | Lead-to-customer source-of-truth + CIS PRD | Implemented | `apps/api/src/modules/leads/readiness.ts`, conversion regressions | Keep this boundary canonical |
| Lead-to-CIS, finance, onboarding readiness flow | CIS/Credit/Onboarding PRD | Implemented | CIS module + readiness module + lead record UI + regressions | Continue tightening checklist/training coupling |
| Immediate BD-team alerting on website lead capture | March session 8 + lead PRD supplement | Partial | recipient configuration exists; dispatch path is not fully evidenced | Verify/build real outbound alert dispatch when email provider is approved |
| Routing basis for Strategic Growth vs TM split | Lead PRD + discovery meetings | Decision | contracts/policy support multiple bases; seed/runtime currently prefer service tech count | Reconcile PRD wording and set canonical basis/default |
| Manual intake data quality: contact channel + affinity/ownership capture | Discovery session 2 + lead PRD supplement | Partial | UI now collects email, phone, affinity, ownership more explicitly; backend still defaults affinity/ownership when omitted | Tighten backend validation once full intake policy is approved |
| Import duplicate preview with merge/skip/create decisions | Lead PRD import requirements | Partial | duplicate review now exists for import rows with `create_new` / `use_existing` decisions across leads and accounts; true merge/update is still missing | Add merge/update semantics only after governance rules are formally signed off |
| Dedupe across leads and existing customers | Lead PRD | Partial | website dedupe and import dedupe now exist, and import review checks both active leads and existing accounts | Expand into a shared dedupe kernel for manual intake and deeper customer-match resolution |
| Onboarding requires 3 training sessions before activation | CIS/Credit/Onboarding PRD | Partial | readiness checklist now models three training checklist items | Next: tie checklist completion to real training-session evidence |
| Map My Customer style lead/customer mobile map | Lead PRD supplement + March session 8 | Missing | no lead/mobile map parity evidenced; current map work is territory-focused | Build lead/customer map read model when mobile map slice begins |

Current hardening priorities:
1. Resolve routing-basis decision and lock seed/default policy
2. Build generic dedupe across manual/import/customer flows
3. Replace checklist-only training gate with training-backed evidence
4. Add merge/update semantics only after cross-entity governance is approved
